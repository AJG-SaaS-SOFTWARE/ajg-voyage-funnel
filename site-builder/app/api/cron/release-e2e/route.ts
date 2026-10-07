import { NextRequest, NextResponse } from "next/server";
import { releaseE2EAuthorized } from "../../../../lib/release-e2e-auth";
import { runReleaseE2EMirror } from "../../../../lib/release-e2e-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!releaseE2EAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appOrigin = (
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  ).replace(/\/$/, "");

  const result = await runReleaseE2EMirror(appOrigin, {
    includeAi: true,
    label: "full"
  });

  return NextResponse.json(result.body, { status: result.status });
}
