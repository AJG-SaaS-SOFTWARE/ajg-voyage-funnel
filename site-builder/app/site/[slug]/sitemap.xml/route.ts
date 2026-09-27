import { getPublicSite, publicSiteUrl } from "../../../../lib/public-site";

export const dynamic = "force-dynamic";

function xmlEscape(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char] || char));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const root = publicSiteUrl(slug).replace(/\/$/, "");
  const pages = site.config.architecture.mode === "multi"
    ? site.config.architecture.pages.filter((page) => page.enabled)
    : [{ slug: "" }];
  const urls = pages.map((page) => page.slug ? `${root}/p/${encodeURIComponent(page.slug)}` : root);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`).join("\n")}\n</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
