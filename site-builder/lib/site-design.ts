export type MediaChoice = {
  url: string;
  title: string;
  creator: string;
  sourceUrl: string;
  licenseUrl: string;
};

export type SiteDesign = {
  accent: string;
  pattern: "none" | "dots" | "lines" | "grid" | "rays";
  heroImage: MediaChoice | null;
  audio: MediaChoice | null;
};

export const accentColors = ["#57d4c9", "#e9ae65", "#90b8ef", "#d99bb2", "#b8cb83"] as const;
export const patterns = ["none", "dots", "lines", "grid", "rays"] as const;

export const defaultSiteDesign: SiteDesign = {
  accent: accentColors[0],
  pattern: "none",
  heroImage: null,
  audio: null
};

export function safeHttpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function mediaChoice(value: unknown): MediaChoice | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const url = safeHttpsUrl(item.url);
  const sourceUrl = safeHttpsUrl(item.sourceUrl);
  if (!url || !sourceUrl) return null;
  return {
    url,
    sourceUrl,
    title: typeof item.title === "string" ? item.title.slice(0, 160) : "Œuvre sans titre",
    creator: typeof item.creator === "string" ? item.creator.slice(0, 120) : "Auteur non indiqué",
    licenseUrl: safeHttpsUrl(item.licenseUrl)
  };
}

export function normalizeSiteDesign(value: unknown): SiteDesign {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    accent: accentColors.find((color) => color === input.accent) || defaultSiteDesign.accent,
    pattern: patterns.find((pattern) => pattern === input.pattern) || defaultSiteDesign.pattern,
    heroImage: mediaChoice(input.heroImage),
    audio: mediaChoice(input.audio)
  };
}
