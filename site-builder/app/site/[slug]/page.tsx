"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import SitePreview from "../../../components/SitePreview";
import { type SiteConfig } from "../../../lib/site-config";
import { loadPublished } from "../../../lib/site-store";

export default function PublishedSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const record = loadPublished(slug);
    setConfig(record?.config || null);
    setLoaded(true);
  }, [slug]);

  if (!loaded) return null;

  if (!config) {
    return (
      <main className="not-found">
        <p className="eyebrow">Prototype</p>
        <h1>Site introuvable</h1>
        <p>Ce site n'est publié que dans le navigateur qui a servi à créer le prototype.</p>
        <Link className="button primary" href="/builder">Retour au builder</Link>
      </main>
    );
  }

  return (
    <main className="published-page">
      <SitePreview config={config} />
      <div className="prototype-ribbon">
        Prototype local · <Link href="/builder">Modifier ce site</Link>
      </div>
    </main>
  );
}
