"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SitePreview from "../../components/SitePreview";
import { defaultSiteConfig, type SiteConfig } from "../../lib/site-config";
import { loadDraft } from "../../lib/site-store";
import { isSupabaseConfigured } from "../../lib/supabase-browser";
import { getMySite } from "../../lib/supabase-site-repository";
import { LanguageSwitch, useUiLanguage } from "../../components/LanguageProvider";

export default function PreviewPage() {
  const { locale } = useUiLanguage();
  const en = locale === "en";
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
      <header className="preview-toolbar"><LanguageSwitch compact />
        <Link href="/builder">← {en ? "Edit" : "Modifier"}</Link>
        <strong>{en ? "Website preview" : "Aperçu du site"}</strong>
        <span>{en ? "Preview · target domain:" : "Aperçu · domaine cible :"} {config.slug ? config.slug + ".voyage.ajgsolutionsgroup.com" : (en ? "to choose" : "à choisir")}</span>
      </header>
      <div className="preview-canvas">
        <SitePreview config={config} />
      </div>
    </main>
  );
}
