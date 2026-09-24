"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SitePreview from "../../components/SitePreview";
import { defaultSiteConfig, type SiteConfig } from "../../lib/site-config";
import { loadDraft } from "../../lib/site-store";

export default function PreviewPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);

  useEffect(() => {
    setConfig(loadDraft().config);
  }, []);

  return (
    <main className="preview-page">
      <header className="preview-toolbar">
        <Link href="/builder">← Modifier</Link>
        <strong>Aperçu du site</strong>
        <span>{config.slug}.voyage.ajgsolutionsgroup.com</span>
      </header>
      <div className="preview-canvas">
        <SitePreview config={config} />
      </div>
    </main>
  );
}
