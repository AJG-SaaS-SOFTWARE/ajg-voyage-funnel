import { NextResponse } from "next/server";
import {
  authorizedCockpitRequest,
  buildBuilderBusinessReport
} from "../../../../lib/business-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.AJG_COCKPIT_REPORTING_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "business_reporting_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!authorizedCockpitRequest(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    return NextResponse.json(await buildBuilderBusinessReport(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "business_reporting_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
