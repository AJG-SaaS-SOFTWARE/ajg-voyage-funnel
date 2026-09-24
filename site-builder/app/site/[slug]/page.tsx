"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import SitePreview from "../../../components/SitePreview";
import { type SiteConfig } from "../../../lib/site-config";
import { loadPublished } from "../../../lib/site-store";
import { isSupabaseConfigured } from "../../../lib/supabase-browser";
import { getPublishedSite } from "../../../lib/supabase-site-repository";

export default function PublishedSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<"cloud" | "local" | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (isSupabaseConfigured()) {
          const remote = await getPublishedSite(slug);
          if (remote && !cancelled) {
            setConfig(remote.config);
            setSource("cloud");
            setLoaded(true);
            return;
          }
        }

        const local = loadPublished(slug);
        if (!cancelled) {
          setConfig(local?.config || null);
          setSource(local ? "local" : null);
        }
      } catch {
        const local = loadPublished(slug);
        if (!cancelled) {
          setConfig(local?.config || null);
          setSource(local ? "local" : null);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!loaded) {
    return (
      <main className="loading-page">
        <div className="loading-dot" />
        <p>Chargement du site…</p>
      </main>
    );
  }

  if (!config) {
    return (
      <main className="not-found">
        <p className="eyebrow">AJG Site Builder</p>
        <h1>Site introuvable</h1>
        <p>Ce site n'existe pas, n'est pas encore publié ou a été suspendu.</p>
        <Link className="button primary" href="/">Retour</Link>
      </main>
    );
  }

  return (
    <main className="published-page">
      <SitePreview config={config} />
      {source === "local" ? (
        <div className="prototype-ribbon">
          Prototype local · <Link href="/builder">Modifier ce site</Link>
        </div>
      ) : null}
    </main>
  );
}
