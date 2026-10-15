import type { ContentAsset, SiteConfig } from "./site-config";

// Use one projection for creation, strategy reuse and revision. Binary media and
// private storage URLs are not needed by the text architect.
export function architectRequestAssets(assets: readonly ContentAsset[]) {
  return assets.map(asset => ({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    text: asset.kind === "text" ? asset.text : "",
    rights: asset.rights,
    publishable: asset.publishable,
    sourceUrl: asset.sourceUrl,
    notes: asset.notes
  }));
}

export function architectRevisionBaseline(config: SiteConfig) {
  const modules = config.design.modules;
  return {
    heroTagline: config.heroTagline,
    heroTitle: config.heroTitle,
    heroSubtitle: config.heroSubtitle,
    aboutHeading: config.aboutHeading,
    aboutText: config.aboutText,
    bookingLabel: config.bookingLabel,
    architecture: config.architecture,
    design: {
      layout: config.design.layout,
      heroLayout: config.design.heroLayout,
      contentWidth: config.design.contentWidth,
      accent: config.design.accent,
      background: config.design.background,
      pattern: config.design.pattern,
      patternStrength: config.design.patternStrength
    },
    recommendedModules: modules.order.filter(key => modules[key]?.enabled),
    moduleOrder: modules.order,
    faq: modules.faq,
    benefits: modules.benefits
  };
}
