"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SitePreview from "../../components/SitePreview";
import { defaultSiteConfig, type SiteConfig } from "../../lib/site-config";
import { loadDraft } from "../../lib/site-store";
import { isSupabaseConfigured } from "../../lib/supabase-browser";
import { getMySite } from "../../lib/supabase-site-repository";

export default function PreviewPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const local = loadDraft();
      if (!isSupabaseConfigured()) {
        setConfig(local.config);
        return;
      }

      try {
        const remote = await getMySite();
        if (!cancelled) setConfig(remote?.config || local.config);
      } catch {
        if (!cancelled) setConfig(local.config);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
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
