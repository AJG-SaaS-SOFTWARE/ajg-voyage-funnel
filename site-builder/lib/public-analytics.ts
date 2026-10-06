export type PublicMetricKey = "page_view" | "primary_cta_click" | "contact_submit";

export function recordPublicMetric(
  siteId: string,
  pageKey: string,
  metricKey: PublicMetricKey
) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ siteId, pageKey, metricKey });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/public/analytics", blob)) return;
    }
  } catch {
    // Fall through to a non-blocking fetch.
  }

  void fetch("/api/public/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit"
  }).catch(() => undefined);
}
