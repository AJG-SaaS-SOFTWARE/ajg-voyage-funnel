import { NextResponse } from "next/server";
import { runStorageBackup } from "../../../../lib/storage-backup";
import { runAiFinopsMonitorSafely } from "../../../../lib/ai-finops-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const finops = await runAiFinopsMonitorSafely();
    const result = await runStorageBackup();

    return NextResponse.json(
      { ...result, finops },
      {
        status:
          finops.ok &&
          (result.ok || !result.configured)
            ? 200
            : 503,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch (error) {
    console.error("builder_storage_backup_failed", {
      message: error instanceof Error ? error.message : "unknown error"
    });

    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: "storage backup failed"
      },
      { status: 500 }
    );
  }
}
