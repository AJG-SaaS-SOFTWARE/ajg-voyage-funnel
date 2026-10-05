import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getStorageBackupStatus,
  runStorageBackup
} from "../../../../lib/storage-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireAdmin(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url || !publishable) {
    return { ok: false as const, response: NextResponse.json({ error: "Administration indisponible." }, { status: 503 }) };
  }

  const token = bearer(request);
  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const client = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user },
    error: userError
  } = await client.auth.getUser(token);

  if (userError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: role, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || role?.role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const status = await getStorageBackupStatus();
    return NextResponse.json(
      { ok: true, ...status },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch (error) {
    console.error("admin_storage_backup_status_failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "État de sauvegarde indisponible." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await runStorageBackup();
    if (!result.configured) {
      return NextResponse.json(
        {
          error:
            "Le store Vercel Blob privé n’est pas encore connecté à ELTARA.",
          configured: false
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: true, result },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch (error) {
    console.error("admin_storage_backup_run_failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "La sauvegarde n’a pas pu être finalisée." },
      { status: 500 }
    );
  }
}
