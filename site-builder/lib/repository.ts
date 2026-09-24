import type { SiteConfig } from "./site-config";

export type SiteRecord = {
  id: string;
  ownerId: string;
  slug: string;
  status: "draft" | "published" | "suspended";
  config: SiteConfig;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
};

export interface SiteRepository {
  getBySlug(slug: string): Promise<SiteRecord | null>;
  saveDraft(ownerId: string, config: SiteConfig): Promise<SiteRecord>;
  publish(ownerId: string, config: SiteConfig): Promise<SiteRecord>;
}

/**
 * Le prototype 0.2 utilise encore localStorage côté UI.
 * Cette interface est la frontière qui permettra de brancher Supabase
 * sans réécrire le builder ou le rendu public.
 */
