"use client";

import { useEffect } from "react";
import { recordPublicMetric, type PublicMetricKey } from "../lib/public-analytics";

export default function PublicSiteAnalytics({
  siteId,
  pageKey
}: {
  siteId: string;
  pageKey: string;
}) {
  useEffect(() => {
    recordPublicMetric(siteId, pageKey, "page_view");

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tracked = target.closest<HTMLElement>("[data-eltara-metric]");
      const metric = tracked?.dataset.eltaraMetric as PublicMetricKey | undefined;
      if (metric === "primary_cta_click") {
        recordPublicMetric(siteId, pageKey, metric);
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [siteId, pageKey]);

  return null;
}
