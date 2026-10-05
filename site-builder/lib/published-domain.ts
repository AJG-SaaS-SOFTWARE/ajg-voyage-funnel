const DEFAULT_PUBLISHED_ROOT_DOMAIN = "eltara.ajgsolutionsgroup.com";
const LEGACY_PUBLISHED_ROOT_DOMAINS = ["voyage.ajgsolutionsgroup.com"];

function normalizeRoot(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\.+|\.+$/g, "");
}

export function preferredPublishedRootDomain() {
  return normalizeRoot(
    process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN || DEFAULT_PUBLISHED_ROOT_DOMAIN
  );
}

export function publishedRootDomains() {
  const configuredLegacy = (process.env.NEXT_PUBLIC_LEGACY_PUBLISHED_ROOT_DOMAINS || "")
    .split(",")
    .map(normalizeRoot)
    .filter(Boolean);

  return [...new Set([
    preferredPublishedRootDomain(),
    ...LEGACY_PUBLISHED_ROOT_DOMAINS,
    ...configuredLegacy
  ])];
}

export function managedHostname(slug: string) {
  return `${slug.trim().toLowerCase()}.${preferredPublishedRootDomain()}`;
}

export function managedSlugFromHostname(hostname: string) {
  const normalized = normalizeRoot(hostname);

  for (const root of publishedRootDomains()) {
    const suffix = "." + root;
    if (!normalized.endsWith(suffix)) continue;
    const slug = normalized.slice(0, -suffix.length);
    if (!slug || slug.includes(".")) return null;
    return slug;
  }

  return null;
}
