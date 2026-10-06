"use client";

import { useEffect } from "react";

export type PublicAnalyticsEvent = "page_view" | "cta_click" | "form_start" | "form_submit";

export function recordPublicAnalytics(
  siteId: string,
  eventName: PublicAnalyticsEvent,
  pagePath: string,
  eventLabel = ""
) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    siteId,
    eventName,
    pagePath,
    eventLabel,
    referrer: document.referrer || ""
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/public/analytics", blob)) return;
  }

  void fetch("/api/public/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "omit",
    cache: "no-store"
  }).catch(() => undefined);
}

export default function PublicAnalyticsTracker({
  siteId,
  pagePath
}: {
  siteId: string;
  pagePath: string;
}) {
  useEffect(() => {
    recordPublicAnalytics(siteId, "page_view", pagePath);

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-eltara-analytics]")
        : null;
      const label = target?.dataset.eltaraAnalytics || "";
      if (label) recordPublicAnalytics(siteId, "cta_click", pagePath, label);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [siteId, pagePath]);

  return null;
}
