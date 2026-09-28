import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedSite from "../../../../../components/PublishedSite";
import { getPublicSite, publicSiteUrl } from "../../../../../lib/public-site";
import { publicRouteBase } from "../../../../../lib/public-request";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; pageSlug: string }> }): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const site = await getPublicSite(slug);
  const page = site?.config.architecture.pages.find((item) => item.enabled && item.slug === pageSlug);
  if (!site || !page || site.config.architecture.mode !== "multi") return { title: "Page introuvable | AJG Site Builder", robots: { index: false, follow: false } };
  const title = `${page.title} | ${site.config.brandName}`;
  const description = site.config.heroSubtitle || site.config.aboutText.slice(0, 160);
  return { title, description, alternates: { canonical: `${await publicSiteUrl(site.id, slug)}/p/${encodeURIComponent(pageSlug)}` }, robots: { index: true, follow: true } };
}

export default async function SiteSubPage({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  const site = await getPublicSite(slug);
  if (!site || site.config.architecture.mode !== "multi" || !site.config.architecture.pages.some((page) => page.enabled && page.slug === pageSlug)) notFound();
  return <PublishedSite config={site.config} pageSlug={pageSlug} routeBase={await publicRouteBase(slug)} />;
}
