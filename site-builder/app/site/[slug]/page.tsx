import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedSite from "../../../components/PublishedSite";
import { getPublicSite, publicSiteUrl } from "../../../lib/public-site";
import { publicRouteBase } from "../../../lib/public-request";
import { buildPublicMetadata } from "../../../lib/public-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);

  if (!site) {
    return {
      title: "Site introuvable | AJG Site Builder",
      robots: { index: false, follow: false }
    };
  }

  const canonical = await publicSiteUrl(site.id, slug);
  return buildPublicMetadata(site.config, { canonical });
}

export default async function PublishedSitePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();

  return <PublishedSite config={site.config} routeBase={await publicRouteBase(slug)} />;
}
