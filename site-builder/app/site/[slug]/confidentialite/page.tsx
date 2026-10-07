import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrivacyPage } from "../../../../components/SiteLegalPages";
import { getPublicSite, publicSiteUrl } from "../../../../lib/public-site";
import { legalIsComplete } from "../../../../lib/site-legal";
import { publicRouteBase } from "../../../../lib/public-request";
import { buildPublicMetadata, legalMetadataLabel } from "../../../../lib/public-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return { title: "Site introuvable", robots: { index: false, follow: false } };
  return {
    ...buildPublicMetadata(site.config, {
      canonical: `${await publicSiteUrl(site.id, slug)}/confidentialite`,
      pageTitle: legalMetadataLabel(site.config, "confidentialite"),
      index: false
    })
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site || !legalIsComplete(site.config.legal, site.config.firstName, site.config.lastName)) notFound();
  return <PrivacyPage config={site.config} routeBase={await publicRouteBase(slug)} />;
}
