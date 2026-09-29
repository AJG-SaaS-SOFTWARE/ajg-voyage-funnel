"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SitePreview from "../../components/SitePreview";
import { defaultSiteConfig, type SiteConfig } from "../../lib/site-config";
import { loadDraft } from "../../lib/site-store";
import { isSupabaseConfigured } from "../../lib/supabase-browser";
import { getMySite } from "../../lib/supabase-site-repository";
import { useProductLocale } from "../../lib/product-i18n";
import { LanguageSwitch } from "../../components/LanguageSwitch";

export default function PreviewPage() {
  const { tr } = useProductLocale();
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
        <Link href="/builder">← {tr("Modifier", "Edit")}</Link>
        <strong>{tr("Aperçu du site", "Website preview")}</strong>
        <span>{tr("Aperçu · domaine cible :", "Preview · target domain:")} {config.slug ? config.slug + ".voyage.ajgsolutionsgroup.com" : tr("à choisir", "to choose")}</span><LanguageSwitch compact />
      </header>
      <div className="preview-canvas">
        <SitePreview config={config} />
      </div>
    </main>
  );
}
