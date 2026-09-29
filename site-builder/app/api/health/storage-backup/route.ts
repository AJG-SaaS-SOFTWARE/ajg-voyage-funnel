import { NextResponse } from "next/server";
import { getStorageBackupStatus } from "../../../../lib/storage-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getStorageBackupStatus();

    return NextResponse.json(
      {
        ok: true,
        configured: status.configured,
        status: status.status,
        lastCompletedAt: status.lastCompletedAt,
        ageHours:
          status.ageHours === null
            ? null
            : Math.round(status.ageHours * 10) / 10,
        sourceObjects: status.sourceObjects,
        retentionDays: status.retentionDays
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch {
    return NextResponse.json(
      {
        ok: true,
        configured: true,
        status: "unknown",
        lastCompletedAt: null,
        ageHours: null,
        sourceObjects: null
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  }
}
