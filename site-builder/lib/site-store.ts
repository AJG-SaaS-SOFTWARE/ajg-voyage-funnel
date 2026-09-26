"use client";

import { defaultSiteConfig, type SiteConfig } from "./site-config";
import { normalizeSiteDesign } from "./site-design";
import { normalizeSiteLegalConfig } from "./site-legal";

export type BuilderDraft = {
  config: SiteConfig;
  status: "draft" | "published";
  updatedAt: string;
  publishedAt?: string;
};

const draftKey = "ajg-site-builder:draft";
const publishedPrefix = "ajg-site-builder:published:";

export function loadDraft(): BuilderDraft {
  if (typeof window === "undefined") {
    return { config: defaultSiteConfig, status: "draft", updatedAt: new Date(0).toISOString() };
  }
  const raw = window.localStorage.getItem(draftKey);
  if (!raw) {
    return { config: defaultSiteConfig, status: "draft", updatedAt: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(raw) as BuilderDraft;
    return {
      ...parsed,
      config: { ...defaultSiteConfig, ...parsed.config, affiliation: parsed.config?.affiliation === "independent" ? "independent" : "mwr", design: normalizeSiteDesign(parsed.config?.design), legal: normalizeSiteLegalConfig(parsed.config?.legal) }
    };
  } catch {
    return { config: defaultSiteConfig, status: "draft", updatedAt: new Date().toISOString() };
  }
}

export function saveDraft(config: SiteConfig, status: BuilderDraft["status"] = "draft") {
  const draft: BuilderDraft = {
    config,
    status,
    updatedAt: new Date().toISOString()
  };
  window.localStorage.setItem(draftKey, JSON.stringify(draft));
  return draft;
}

export function publishDraft(config: SiteConfig) {
  const published: BuilderDraft = {
    config,
    status: "published",
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  };
  window.localStorage.setItem(draftKey, JSON.stringify(published));
  window.localStorage.setItem(publishedPrefix + config.slug, JSON.stringify(published));
  return published;
}

export function loadPublished(slug: string): BuilderDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(publishedPrefix + slug);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BuilderDraft;
    return { ...parsed, config: { ...defaultSiteConfig, ...parsed.config, affiliation: parsed.config?.affiliation === "independent" ? "independent" : "mwr", design: normalizeSiteDesign(parsed.config?.design), legal: normalizeSiteLegalConfig(parsed.config?.legal) } };
  } catch {
    return null;
  }
}

export function resetDraft() {
  window.localStorage.removeItem(draftKey);
}
