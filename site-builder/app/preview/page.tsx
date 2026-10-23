"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import SitePreview from "../../components/SitePreview";
import { defaultSiteConfig, type SiteConfig } from "../../lib/site-config";
import { loadDraft } from "../../lib/site-store";
import { isSupabaseConfigured } from "../../lib/supabase-browser";
import { getMySite } from "../../lib/supabase-site-repository";
import { useProductLocale } from "../../lib/product-i18n";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { preferredPublishedRootDomain } from "../../lib/published-domain";

const PREVIEW_LOAD_TIMEOUT_MS = 15_000;

async function withPreviewLoadDeadline<T>(work: Promise<T>) {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("preview_load_timeout")),
          PREVIEW_LOAD_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

type PreviewLoadState = "checking" | "remote" | "local" | "error";

export default function PreviewPage() {
  const { tr } = useProductLocale();
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [loadState, setLoadState] = useState<PreviewLoadState>("checking");
  const loadSequence = useRef(0);

  const loadPreview = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const local = loadDraft();
    setConfig(local.config);

    if (!isSupabaseConfigured()) {
      setLoadState("local");
      return;
    }

    setLoadState("checking");
    try {
      const remote = await withPreviewLoadDeadline(getMySite());
      if (sequence !== loadSequence.current) return;
      setConfig(remote?.config || local.config);
      setLoadState(remote ? "remote" : "local");
    } catch {
      if (sequence !== loadSequence.current) return;
      setConfig(local.config);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadPreview();
    return () => {
      loadSequence.current += 1;
    };
  }, [loadPreview]);

  return (
    <main className="preview-page">
      <header className="preview-toolbar">
        <Link href="/builder">← {tr("Modifier", "Edit")}</Link>
        <strong>{tr("Aperçu du site", "Website preview")}</strong>
        <span>{tr("Aperçu · domaine cible :", "Preview · target domain:")} {config.slug ? `${config.slug}.${preferredPublishedRootDomain()}` : tr("à choisir", "to choose")}</span>
        <span aria-live="polite">
          {loadState === "remote"
            ? tr("Brouillon synchronisé", "Draft synchronized")
            : loadState === "checking"
              ? tr("Vérification du brouillon…", "Checking draft…")
              : loadState === "error"
                ? tr("Aperçu local · synchronisation indisponible", "Local preview · synchronization unavailable")
                : tr("Aperçu local", "Local preview")}
          {loadState === "error" ? (
            <button type="button" className="button secondary" onClick={() => void loadPreview()}>
              {tr("Réessayer", "Try again")}
            </button>
          ) : null}
        </span>
        <LanguageSwitch compact />
      </header>
      <div className="preview-canvas">
        <SitePreview config={config} />
      </div>
    </main>
  );
}
