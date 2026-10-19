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

// A persisted hostname is data, not an authorized fetch destination. Keep the
// permissive display/routing normalizer above out of this network boundary.
export function managedCanaryUrl(hostname: unknown): string | null {
  if (typeof hostname !== "string" || hostname !== hostname.trim()) return null;
  const normalized = hostname.toLowerCase();
  const labels = normalized.split(".");
  const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (normalized.length > 253 || !labels.every(part => label.test(part)) ||
      !/[a-z]/.test(labels.at(-1) || "")) return null;
  const slug = managedSlugFromHostname(normalized);
  if (!slug || !label.test(slug)) return null;
  try {
    const target = new URL(`https://${normalized}/`);
    if (target.protocol !== "https:" || target.hostname !== normalized ||
        target.username || target.password || target.port ||
        target.pathname !== "/" || target.search || target.hash) return null;
    return target.href;
  } catch {
    return null;
  }
}
