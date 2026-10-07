import { NextRequest, NextResponse } from "next/server";
import { runReleaseE2EMirror } from "../../../../lib/release-e2e-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const authorization = request.headers.get("authorization") || "";
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appOrigin = (
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  ).replace(/\/$/, "");

  const result = await runReleaseE2EMirror(appOrigin, {
    includeAi: false,
    label: "structural"
  });

  return NextResponse.json(result.body, { status: result.status });
}
