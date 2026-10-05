import { NextResponse } from "next/server";
import { runStorageBackup } from "../../../../lib/storage-backup";
import { runSupportReconciliationSafely } from "../../../../lib/support-reconcile";
import { runSupportRemediationSweepSafely } from "../../../../lib/support-remediation-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RunAction =
  | "support_reconcile"
  | "support_remediation_sweep"
  | "storage_backup";

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

function authorized(request: Request) {
  const expected = process.env.AJG_RUN_TOKEN?.trim();
  const supplied = bearer(request);
  if (!expected || !supplied || expected.length !== supplied.length) return false;

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as RunAction | undefined;

  if (
    action !== "support_reconcile" &&
    action !== "support_remediation_sweep" &&
    action !== "storage_backup"
  ) {
    return NextResponse.json(
      { ok: false, error: "unsupported run action" },
      { status: 400 },
    );
  }

  try {
    if (action === "support_reconcile") {
      const result = await runSupportReconciliationSafely();
      return NextResponse.json(
        { ok: result.ok, action, result },
        { status: result.ok ? 200 : 503 },
      );
    }

    if (action === "support_remediation_sweep") {
      const result = await runSupportRemediationSweepSafely();
      return NextResponse.json(
        { ok: result.ok, action, result },
        { status: result.ok ? 200 : 503 },
      );
    }

    const result = await runStorageBackup();
    return NextResponse.json(
      { ok: result.ok, action, result },
      { status: result.ok ? 200 : result.configured ? 503 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        action,
        error: error instanceof Error ? error.message : "run action failed",
      },
      { status: 500 },
    );
  }
}
