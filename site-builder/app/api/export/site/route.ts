import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createTarGzipStream,
  recoveryArchiveFilename,
  recoveryMediaArchivePath,
  type RecoveryTarEntry
} from "../../../../lib/recovery-archive";
import { recoverySiteSnapshot } from "../../../../lib/recovery-snapshot";
import { readRecoveryRecords } from "../../../../lib/recovery-records";
import { localize, requestProductLocale } from "../../../../lib/server-locale";

export const runtime = "nodejs";

type ExportMedia = {
  bucket: string;
  path: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  url: string | null;
};

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function GET(request: Request) {
  const locale = requestProductLocale(request);
  const tr = (fr: string, en: string) => localize(locale, fr, en);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return NextResponse.json({ error: tr("Service d’export non configuré.", "Export service not configured.") }, { status: 503 });
  }

  const token = bearer(request);
  if (!token) return NextResponse.json({ error: tr("Reconnectez-vous pour continuer.", "Sign in again to continue.") }, { status: 401 });

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: tr("Connexion requise.", "Sign-in required.") }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const siteId = requestUrl.searchParams.get("siteId");
  const format = requestUrl.searchParams.get("format");
  const requestedFormat = format === "archive" ? "archive" : format === "recovery" ? "recovery" : "json";
  if (!siteId) {
    return NextResponse.json({ error: tr("Identifiant du site requis.", "Website identifier required.") }, { status: 400 });
  }

  const { data: site, error: siteError } = await userClient
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (siteError || !site) {
    return NextResponse.json({ error: tr("Site indisponible.", "Website unavailable.") }, { status: 404 });
  }

  const { data: caps, error: capError } = await userClient.rpc(
    "get_my_site_capabilities",
    { p_site_id: site.id }
  );
  const cap = Array.isArray(caps) ? caps[0] : caps;
  if (capError || !cap?.can_export) {
    return NextResponse.json({ error: tr("Export indisponible.", "Export unavailable.") }, { status: 403 });
  }

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const prefix = user.id + "/" + site.id;

  async function walk(bucket: string, folder: string, isPublic: boolean): Promise<ExportMedia[]> {
    const out: ExportMedia[] = [];
    const pageSize = 1000;

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await service.storage
        .from(bucket)
        .list(folder, {
          limit: pageSize,
          offset,
          sortBy: { column: "name", order: "asc" }
        });

      if (error) {
        if (bucket === "site-private-media" && /not found/i.test(error.message)) return out;
        throw error;
      }

      const page = data || [];
      for (const item of page) {
        const path = folder + "/" + item.name;
        if (item.id) {
          const publicUrl = isPublic
            ? service.storage.from(bucket).getPublicUrl(path).data.publicUrl
            : null;
          out.push({
            bucket,
            path,
            name: item.name,
            size: item.metadata?.size ?? null,
            mimeType:
              ((item.metadata as Record<string, unknown> | null)?.mimetype as string) ?? null,
            url: publicUrl
          });
        } else {
          out.push(...await walk(bucket, path, isPublic));
        }
      }

      if (page.length < pageSize) break;
    }

    return out;
  }

  let draft: { config: unknown; updated_at: string | null } | null;
  let media: ExportMedia[];
  let domains: unknown[];
  let journals: unknown[];
  let contacts: unknown[];
  try {
    const { data: ownedDraft, error: draftError } = await userClient
      .from("site_drafts")
      .select("config,updated_at")
      .eq("site_id", site.id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (draftError || (ownedDraft && (!ownedDraft.config || typeof ownedDraft.config !== "object" || Array.isArray(ownedDraft.config)))) {
      throw new Error("recovery_draft_unavailable");
    }
    draft = ownedDraft;
    if (requestedFormat === "recovery") {
      return NextResponse.json({
        format: "ajg-builder-export-v2",
        scope: "configuration",
        exportedAt: new Date().toISOString(),
        site: recoverySiteSnapshot(site, draft),
        note: tr(
          "Fichier de restauration de la configuration publiée et du brouillon éventuel. Pour conserver aussi les médias et les autres données, téléchargez l’archive complète.",
          "Recovery file for the published configuration and any saved draft. Download the full archive to also preserve media and other data."
        )
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    media = [
      ...await walk("site-media", prefix, true),
      ...await walk("site-private-media", prefix, false)
    ];
    [domains, journals, contacts] = await Promise.all([
      readRecoveryRecords((from, to) => service
        .from("domains")
        .select("hostname,kind,verification_status,is_primary")
        .eq("site_id", site.id)
        .order("id", { ascending: true })
        .range(from, to)),
      readRecoveryRecords((from, to) => service
        .from("travel_journals")
        .select("slug,title,excerpt,body,status,published_at,updated_at")
        .eq("site_id", site.id)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)),
      readRecoveryRecords((from, to) => service
        .from("contact_messages")
        .select("sender_name,sender_email,subject,message,consent_at,created_at")
        .eq("site_id", site.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to))
    ]);
  } catch {
    return NextResponse.json(
      { error: tr("Impossible de préparer un export complet pour le moment. Réessayez plus tard.", "Unable to prepare a complete export right now. Please try again later.") },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const commonPayload = {
    exportedAt: new Date().toISOString(),
    site: recoverySiteSnapshot(site, draft),
    domains,
    travelJournals: journals,
    contactMessages: contacts
  };

  if (requestedFormat === "json") {
    return NextResponse.json(
      {
        format: "ajg-builder-export-v2",
        ...commonPayload,
        media,
        note: tr(
          "Export de récupération : configuration publiée, brouillon éventuel, domaines et inventaire des médias conservés. Les médias publics incluent leur URL ; les médias privés restent référencés sans URL publique et sont conservés pour récupération serveur.",
          "Recovery export: published configuration, any saved draft, domains and retained media inventory. Public media includes its URL; private media remains referenced without a public URL and is retained for server-side recovery."
        )
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const archiveMedia = media.map((item, index) => ({
    ...item,
    archivePath: recoveryMediaArchivePath(item.bucket, index, item.name)
  }));
  const archivePayload = {
    format: "ajg-builder-export-v3",
    ...commonPayload,
    media: archiveMedia,
    note: tr(
      "Archive de récupération complète. Le manifeste décrit chaque média et son chemin dans l'archive. Si export-errors.json est présent, certains fichiers n'ont pas pu être copiés et y sont listés.",
      "Complete recovery archive. The manifest describes each media item and its archive path. If export-errors.json is present, some files could not be copied and are listed there."
    )
  };

  async function* archiveEntries(): AsyncGenerator<RecoveryTarEntry> {
    yield {
      path: "ajg-builder-export.json",
      data: JSON.stringify(archivePayload, null, 2)
    };
    yield {
      path: "README.txt",
      data: [
        tr("ELTARA - archive de récupération", "ELTARA - recovery archive"),
        "",
        tr(
          "ajg-builder-export.json contient la configuration publiée, le brouillon éventuel, les domaines, les carnets, les messages de contact et l'inventaire des médias.",
          "ajg-builder-export.json contains the published configuration, any saved draft, domains, journals, contact messages and media inventory."
        ),
        tr("media/public contient les fichiers déjà publiables.", "media/public contains files already available for public use."),
        tr("media/private contient les fichiers privés de la bibliothèque utilisateur.", "media/private contains private files from the user library."),
        tr(
          "Si export-errors.json existe, certains fichiers n'ont pas pu être copiés dans cette archive.",
          "If export-errors.json exists, some files could not be copied into this archive."
        ),
        ""
      ].join("\n")
    };

    const failures: Array<{ bucket: string; path: string; reason: string }> = [];

    for (const item of archiveMedia) {
      const { data, error } = await service.storage.from(item.bucket).download(item.path);
      if (error || !data) {
        failures.push({
          bucket: item.bucket,
          path: item.path,
          reason: error?.message || tr("Téléchargement impossible", "Download failed")
        });
        continue;
      }

      yield {
        path: item.archivePath,
        data
      };
    }

    if (failures.length) {
      yield {
        path: "export-errors.json",
        data: JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            failedMedia: failures
          },
          null,
          2
        )
      };
    }
  }

  return new NextResponse(createTarGzipStream(archiveEntries()), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="' + recoveryArchiveFilename(site.slug) + '"',
      "Content-Type": "application/gzip",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
