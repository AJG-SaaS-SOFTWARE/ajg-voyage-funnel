import { NextRequest, NextResponse } from "next/server";
import { safeHttpsUrl, type MediaChoice } from "../../../../lib/site-design";

type OpenverseItem = {
  url?: string;
  thumbnail?: string;
  title?: string;
  creator?: string;
  foreign_landing_url?: string;
  license?: string;
  license_url?: string;
  mature?: boolean;
};

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const page = Number(request.nextUrl.searchParams.get("page") || "1");
  if ((type !== "image" && type !== "audio") || !query || query.length > 80 || !Number.isInteger(page) || page < 1 || page > 5) {
    return NextResponse.json({ error: "Choisissez un type et une recherche de 80 caractères maximum." }, { status: 400 });
  }

  const endpoint = new URL(`https://api.openverse.org/v1/${type === "image" ? "images" : "audio"}/`);
  endpoint.search = new URLSearchParams({ q: query, license: "cc0", page_size: "18", page: String(page), mature: "false" }).toString();

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "AJGSiteBuilder/1.0 (https://ajg-site-builder.vercel.app)" },
      next: { revalidate: 3600 }
    });
    if (!response.ok) throw new Error(`Openverse ${response.status}`);
    const data = await response.json() as { results?: OpenverseItem[]; result_count?: number; page_count?: number };
    const results = (data.results || []).flatMap((item) => {
      const url = safeHttpsUrl(item.url);
      const sourceUrl = safeHttpsUrl(item.foreign_landing_url);
      if (item.license !== "cc0" || item.mature || !url || !sourceUrl) return [];
      const choice: MediaChoice = {
        url,
        sourceUrl,
        title: (item.title || "Œuvre sans titre").slice(0, 160),
        creator: (item.creator || "Auteur non indiqué").slice(0, 120),
        licenseUrl: safeHttpsUrl(item.license_url)
      };
      return [{ ...choice, thumbnail: safeHttpsUrl(item.thumbnail) || url }];
    });
    const hasMore = page < 5 && (typeof data.page_count === "number"
      ? page < data.page_count
      : typeof data.result_count === "number"
        ? page * 18 < data.result_count
        : (data.results || []).length === 18);
    return NextResponse.json({ results, hasMore }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json({ error: "La médiathèque est indisponible pour le moment. Réessayez plus tard." }, { status: 503 });
  }
}
