import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expected = process.env.STORAGE_BOOTSTRAP_SECRET;
  const supplied = request.headers.get("authorization");
  if (!expected || supplied !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server storage configuration missing" }, { status: 503 });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) return NextResponse.json({ error: "Unable to inspect storage" }, { status: 500 });
  if (buckets?.some((bucket) => bucket.id === "site-private-media")) return NextResponse.json({ ok: true, created: false });

  const { error } = await supabase.storage.createBucket("site-private-media", {
    public: false,
    allowedMimeTypes: ["image/jpeg","image/png","image/webp","image/avif","audio/mpeg","audio/mp4","audio/ogg","audio/wav","application/pdf","text/plain"],
    fileSizeLimit: "15MB"
  });
  if (error) return NextResponse.json({ error: "Unable to create private storage" }, { status: 500 });
  return NextResponse.json({ ok: true, created: true });
}
