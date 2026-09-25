import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedSite from "../../../components/PublishedSite";
import { getPublicSite, publicSiteUrl } from "../../../lib/public-site";

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

  const title = `${site.config.brandName} | Voyage`;
  const description =
    site.config.heroSubtitle ||
    `Découvrez le site de ${site.config.firstName} ${site.config.lastName}.`;
  const canonical = publicSiteUrl(slug);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: site.config.profileImageUrl ? [site.config.profileImageUrl] : undefined
    },
    robots: { index: true, follow: true }
  };
}

export default async function PublishedSitePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();

  return <PublishedSite config={site.config} />;
}
