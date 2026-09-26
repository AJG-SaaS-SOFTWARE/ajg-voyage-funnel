import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalNoticePage } from "../../../../components/SiteLegalPages";
import { getPublicSite, publicSiteUrl } from "../../../../lib/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return { title: "Site introuvable", robots: { index: false, follow: false } };
  return {
    title: `Mentions légales | ${site.config.brandName}`,
    alternates: { canonical: `${publicSiteUrl(slug)}/mentions-legales` },
    robots: { index: false, follow: true }
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();
  return <LegalNoticePage config={site.config} />;
}
