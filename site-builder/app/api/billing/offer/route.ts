import { NextResponse } from "next/server";
import { growthAnnualIncludesLaunch } from "../../../../lib/growth-launch-offer";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ annualIncludesLaunch: growthAnnualIncludesLaunch() }, {
    headers: { "Cache-Control": "no-store" }
  });
}
