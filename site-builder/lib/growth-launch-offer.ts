// Official offer validated on 13 October: one BUILD package per paid annual period.
// Commercial charging is still controlled by the independent Checkout launch gates.
export function growthAnnualIncludesLaunch() {
  return true;
}

export function growthAnnualLaunchReference(siteId: string, subscriptionId: string, paidThrough: string) {
  const date = new Date(paidThrough);
  if (!siteId || !subscriptionId || !Number.isFinite(date.getTime())) throw new Error("invalid_annual_build_period");
  return `growth_annual:${siteId}:${subscriptionId}:${date.toISOString()}`;
}

