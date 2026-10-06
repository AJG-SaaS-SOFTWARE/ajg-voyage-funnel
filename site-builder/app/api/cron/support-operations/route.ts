import { NextResponse } from "next/server";
import { runSupportOperationsAgentFromEnvironment } from "../../../../lib/support-operations-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const result = await runSupportOperationsAgentFromEnvironment();
    return NextResponse.json(result, {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "support operations failed" },
      { status: 500 }
    );
  }
}
export const POST = GET;
