import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedSite from "../../../../../components/PublishedSite";
import { getPublicSite, publicSiteUrl } from "../../../../../lib/public-site";
import { publicRouteBase } from "../../../../../lib/public-request";
import { buildPublicMetadata } from "../../../../../lib/public-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; pageSlug: string }> }): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const site = await getPublicSite(slug);
  const page = site?.config.architecture.pages.find((item) => item.enabled && item.slug === pageSlug);
  if (!site) return { title: "Website not found / Site introuvable | AJG Site Builder", robots: { index: false, follow: false } };
  if (!page || site.config.architecture.mode !== "multi") return { title: `${site.config.language === "en" ? "Page not found" : "Page introuvable"} | AJG Site Builder`, robots: { index: false, follow: false } };
  const canonical = `${await publicSiteUrl(site.id, slug)}/p/${encodeURIComponent(pageSlug)}`;
  return buildPublicMetadata(site.config, { canonical, pageTitle: page.title });
}

export default async function SiteSubPage({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  const site = await getPublicSite(slug);
  if (!site || site.config.architecture.mode !== "multi" || !site.config.architecture.pages.some((page) => page.enabled && page.slug === pageSlug)) notFound();
  return <PublishedSite config={site.config} pageSlug={pageSlug} routeBase={await publicRouteBase(slug)} />;
}
