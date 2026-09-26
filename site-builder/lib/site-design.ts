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
  patternColor: string;
  pattern: "none" | "dots" | "lines" | "grid" | "rays";
  background: "ivory" | "sand" | "mist" | "sage" | "slate";
  patternStrength: "soft" | "bold";
  showMwrLogo: boolean;
  showTravelAdvantageLogo: boolean;
  showPortrait: boolean;
  showPrimaryButton: boolean;
  showBooking: boolean;
  showInstagram: boolean;
  showFacebook: boolean;
  heroImage: MediaChoice | null;
  audio: MediaChoice | null;
  backgroundPhotoUrl: string;
  backgroundPositionX: number;
  backgroundPositionY: number;
  modules: SiteModules;
};

export type SiteModuleKey = "gallery" | "faq" | "testimonials" | "video" | "figures" | "benefits" | "contact";

export const defaultSiteModuleOrder: SiteModuleKey[] = [
  "gallery", "faq", "testimonials", "video", "figures", "benefits", "contact"
];

export type SiteModules = {
  order: SiteModuleKey[];
  assistantBrief: string;
  gallery: { enabled: boolean; title: string; images: { url: string; caption: string }[] };
  faq: { enabled: boolean; title: string; items: { question: string; answer: string }[] };
  testimonials: { enabled: boolean; title: string; items: { quote: string; author: string }[] };
  contact: { enabled: boolean; title: string; email: string };
  video: { enabled: boolean; title: string; url: string };
  figures: { enabled: boolean; title: string; items: { value: string; label: string }[] };
  benefits: { enabled: boolean; title: string; items: { title: string; text: string }[] };
};

export const defaultSiteModules: SiteModules = {
  order: [...defaultSiteModuleOrder],
  assistantBrief: "",
  gallery: { enabled: false, title: "Mes voyages", images: [] },
  faq: { enabled: false, title: "Questions fréquentes", items: [] },
  testimonials: { enabled: false, title: "Témoignages", items: [] },
  contact: { enabled: false, title: "Me contacter", email: "" },
  video: { enabled: false, title: "Une vidéo pour découvrir", url: "" },
  figures: { enabled: false, title: "En chiffres", items: [] },
  benefits: { enabled: false, title: "Les avantages", items: [] }
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
  patternColor: "",
  pattern: "none",
  background: "ivory",
  patternStrength: "soft",
  showMwrLogo: false,
  showTravelAdvantageLogo: false,
  showPortrait: true,
  showPrimaryButton: true,
  showBooking: true,
  showInstagram: true,
  showFacebook: true,
  heroImage: null,
  audio: null,
  backgroundPhotoUrl: "",
  backgroundPositionX: 50,
  backgroundPositionY: 50,
  modules: defaultSiteModules
};

const surfaceColors: Record<SiteDesign["background"], string> = {
  ivory: "#f8f4eb", sand: "#efe1ca", mist: "#e4eff0", sage: "#e5eddf", slate: "#26373e"
};

export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    return channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function readableInk(background: string) {
  return contrastRatio(background, "#10212b") >= contrastRatio(background, "#ffffff") ? "#10212b" : "#ffffff";
}

export function surfaceInk(design: SiteDesign) {
  const surface = design.customBackgroundColor || surfaceColors[design.background];
  return { surface, ink: readableInk(surface) };
}

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
  const modules = input.modules && typeof input.modules === "object" ? input.modules as Record<string, any> : {};
  const text = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
  const list = (value: unknown) => Array.isArray(value) ? value.slice(0, 12) : [];
  const position = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
  const moduleOrder = (() => {
    const allowed = new Set<SiteModuleKey>(defaultSiteModuleOrder);
    const requested = Array.isArray(modules.order)
      ? modules.order.filter((key: unknown): key is SiteModuleKey => typeof key === "string" && allowed.has(key as SiteModuleKey))
      : [];
    const unique = [...new Set(requested)];
    return [...unique, ...defaultSiteModuleOrder.filter((key) => !unique.includes(key))];
  })();
  return {
    accent: typeof input.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent : defaultSiteDesign.accent,
    customBackgroundColor: typeof input.customBackgroundColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.customBackgroundColor) ? input.customBackgroundColor : "",
    patternColor: typeof input.patternColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.patternColor) ? input.patternColor : "",
    pattern: patterns.find((pattern) => pattern === input.pattern) || defaultSiteDesign.pattern,
    background: backgrounds.find((background) => background === input.background) || defaultSiteDesign.background,
    patternStrength: input.patternStrength === "bold" ? "bold" : "soft",
    showMwrLogo: input.showMwrLogo === true,
    showTravelAdvantageLogo: input.showTravelAdvantageLogo === true,
    showPortrait: input.showPortrait !== false,
    showPrimaryButton: input.showPrimaryButton !== false,
    showBooking: input.showBooking !== false,
    showInstagram: input.showInstagram !== false,
    showFacebook: input.showFacebook !== false,
    heroImage: mediaChoice(input.heroImage),
    audio: mediaChoice(input.audio),
    backgroundPhotoUrl: safeHttpsUrl(input.backgroundPhotoUrl),
    backgroundPositionX: position(input.backgroundPositionX),
    backgroundPositionY: position(input.backgroundPositionY),
    modules: {
      order: moduleOrder,
      assistantBrief: text(modules.assistantBrief, 1000),
      gallery: { enabled: modules.gallery?.enabled === true, title: text(modules.gallery?.title, 100) || defaultSiteModules.gallery.title, images: list(modules.gallery?.images).map((item: any) => ({ url: safeHttpsUrl(item?.url), caption: text(item?.caption, 180) })).filter((item) => item.url) },
      faq: { enabled: modules.faq?.enabled === true, title: text(modules.faq?.title, 100) || defaultSiteModules.faq.title, items: list(modules.faq?.items).map((item: any) => ({ question: text(item?.question, 200), answer: text(item?.answer, 1200) })) },
      testimonials: { enabled: modules.testimonials?.enabled === true, title: text(modules.testimonials?.title, 100) || defaultSiteModules.testimonials.title, items: list(modules.testimonials?.items).map((item: any) => ({ quote: text(item?.quote, 800), author: text(item?.author, 120) })) },
      contact: { enabled: modules.contact?.enabled === true, title: text(modules.contact?.title, 100) || defaultSiteModules.contact.title, email: text(modules.contact?.email, 254) },
      video: { enabled: modules.video?.enabled === true, title: text(modules.video?.title, 100) || defaultSiteModules.video.title, url: safeHttpsUrl(modules.video?.url) },
      figures: { enabled: modules.figures?.enabled === true, title: text(modules.figures?.title, 100) || defaultSiteModules.figures.title, items: list(modules.figures?.items).map((item: any) => ({ value: text(item?.value, 30), label: text(item?.label, 120) })) },
      benefits: { enabled: modules.benefits?.enabled === true, title: text(modules.benefits?.title, 100) || defaultSiteModules.benefits.title, items: list(modules.benefits?.items).map((item: any) => ({ title: text(item?.title, 100), text: text(item?.text, 500) })) }
    }
  };
}
