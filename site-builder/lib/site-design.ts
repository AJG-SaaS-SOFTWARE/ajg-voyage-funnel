export type MediaChoice = {
  url: string;
  title: string;
  creator: string;
  sourceUrl: string;
  licenseUrl: string;
};

export type SiteDesign = {
  accent: string;
  customBackgroundColor: string;
  pattern: "none" | "dots" | "lines" | "grid" | "rays";
  background: "ivory" | "sand" | "mist" | "sage" | "slate";
  patternStrength: "soft" | "bold";
  showMwrLogo: boolean;
  showTravelAdvantageLogo: boolean;
  showPortrait: boolean;
  heroImage: MediaChoice | null;
  audio: MediaChoice | null;
};

export const accentColors = [
  "#57d4c9", "#e9ae65", "#90b8ef", "#d99bb2", "#b8cb83",
  "#e6c76e", "#e98d78", "#a999d4", "#7cc1d8", "#72ad95",
  "#d1a47e", "#ededdf", "#f47c6c", "#f5a65b", "#ffd166", "#6fcf97",
  "#56cfe1", "#4ea8de", "#5e60ce", "#9b5de5", "#f15bb5", "#c77dff",
  "#264653", "#2a9d8f", "#e76f51", "#6b705c", "#8d6e63", "#111827"
] as const;
export const patterns = ["none", "dots", "lines", "grid", "rays"] as const;
export const backgrounds = ["ivory", "sand", "mist", "sage", "slate"] as const;

export const defaultSiteDesign: SiteDesign = {
  accent: accentColors[0],
  customBackgroundColor: "",
  pattern: "none",
  background: "ivory",
  patternStrength: "soft",
  showMwrLogo: false,
  showTravelAdvantageLogo: false,
  showPortrait: true,
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
    accent: typeof input.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent : defaultSiteDesign.accent,
    customBackgroundColor: typeof input.customBackgroundColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.customBackgroundColor) ? input.customBackgroundColor : "",
    pattern: patterns.find((pattern) => pattern === input.pattern) || defaultSiteDesign.pattern,
    background: backgrounds.find((background) => background === input.background) || defaultSiteDesign.background,
    patternStrength: input.patternStrength === "bold" ? "bold" : "soft",
    showMwrLogo: input.showMwrLogo === true,
    showTravelAdvantageLogo: input.showTravelAdvantageLogo === true,
    showPortrait: input.showPortrait !== false,
    heroImage: mediaChoice(input.heroImage),
    audio: mediaChoice(input.audio)
  };
}
