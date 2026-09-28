import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createTarGzipStream,
  recoveryArchiveFilename,
  recoveryMediaArchivePath,
  type RecoveryTarEntry
} from "../../../../lib/recovery-archive";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishable || !serviceKey) {
    return NextResponse.json({ error: "Export service not configured" }, { status: 503 });
  }

  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  const siteId = requestUrl.searchParams.get("siteId");
  const requestedFormat = requestUrl.searchParams.get("format") === "archive" ? "archive" : "json";
  if (!siteId) {
    return NextResponse.json({ error: "Site identifier required" }, { status: 400 });
  }

  const { data: site, error: siteError } = await userClient
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (siteError || !site) {
    return NextResponse.json({ error: "Site unavailable" }, { status: 404 });
  }

  const { data: caps, error: capError } = await userClient.rpc(
    "get_my_site_capabilities",
    { p_site_id: site.id }
  );
  const cap = Array.isArray(caps) ? caps[0] : caps;
  if (capError || !cap?.can_export) {
    return NextResponse.json({ error: "Export unavailable" }, { status: 403 });
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

  const media = [
    ...await walk("site-media", prefix, true),
    ...await walk("site-private-media", prefix, false)
  ];
  const { data: domains } = await service
    .from("domains")
    .select("hostname,kind,verification_status,is_primary")
    .eq("site_id", site.id);
  const { data: journals } = await service
    .from("travel_journals")
    .select("slug,title,excerpt,body,status,published_at,updated_at")
    .eq("site_id", site.id)
    .order("updated_at", { ascending: false });
  const { data: contacts } = await service
    .from("contact_messages")
    .select("sender_name,sender_email,subject,message,consent_at,created_at")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false });

  const commonPayload = {
    exportedAt: new Date().toISOString(),
    site: {
      id: site.id,
      slug: site.slug,
      status: site.status,
      updatedAt: site.updated_at,
      config: {
        slug: site.slug,
        firstName: site.first_name,
        lastName: site.last_name,
        brandName: site.brand_name,
        heroTitle: site.hero_title,
        heroSubtitle: site.hero_subtitle,
        heroTagline: site.hero_tagline,
        aboutText: site.about_text,
        aboutHeading: site.about_heading,
        bookingLabel: site.booking_label,
        bookingUrl: site.booking_url,
        instagramUrl: site.instagram_url,
        facebookUrl: site.facebook_url,
        profileImageUrl: site.profile_image_url,
        showTravelJournals: site.show_travel_journals,
        primaryLanguage: site.primary_language,
        enabledLanguages: site.enabled_languages,
        designAssets: site.design_assets,
        legalConfig: site.legal_config,
        complianceProfile: site.compliance_profile
      }
    },
    domains: domains || [],
    travelJournals: journals || [],
    contactMessages: contacts || []
  };

  if (requestedFormat === "json") {
    return NextResponse.json(
      {
        format: "ajg-builder-export-v2",
        ...commonPayload,
        media,
        note:
          "Export de récupération : configuration, domaines et inventaire des médias conservés. Les médias publics incluent leur URL ; les médias privés restent référencés sans URL publique et sont conservés pour récupération serveur."
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
    note:
      "Archive de récupération complète. Le manifeste décrit chaque média et son chemin dans l'archive. Si export-errors.json est présent, certains fichiers n'ont pas pu être copiés et y sont listés."
  };

  async function* archiveEntries(): AsyncGenerator<RecoveryTarEntry> {
    yield {
      path: "ajg-builder-export.json",
      data: JSON.stringify(archivePayload, null, 2)
    };
    yield {
      path: "README.txt",
      data: [
        "AJG Builder - archive de récupération",
        "",
        "ajg-builder-export.json contient la configuration du site, les domaines, les carnets, les messages de contact et l'inventaire des médias.",
        "media/public contient les fichiers déjà publiables.",
        "media/private contient les fichiers privés de la bibliothèque utilisateur.",
        "Si export-errors.json existe, certains fichiers n'ont pas pu être copiés dans cette archive.",
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
          reason: error?.message || "Download failed"
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
