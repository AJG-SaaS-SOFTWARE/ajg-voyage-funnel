import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ExternalLinkProbeResult = {
  url: string;
  checked: boolean;
  reachable: boolean;
  status: number | null;
  reason: "ok" | "http" | "network" | "unsafe";
};

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".home", ".lan"];

function blockedIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  );
}

function blockedIpv6(address: string) {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return isIP(mapped) === 4 ? blockedIpv4(mapped) : true;
  }
  return false;
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4(address);
  if (family === 6) return !blockedIpv6(address);
  return false;
}

export function safeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !hostname
      || hostname === "localhost"
      || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) return null;

    if (isIP(hostname) && !isPublicAddress(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function hostIsPublic(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(hostname)) return isPublicAddress(hostname);
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.length > 0 && records.every((record) => isPublicAddress(record.address));
  } catch {
    return false;
  }
}

function reachableStatus(status: number) {
  return (
    (status >= 200 && status < 400)
    || status === 401
    || status === 403
    || status === 405
    || status === 429
  );
}

async function requestOnce(url: URL, method: "HEAD" | "GET", timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: method === "GET"
        ? { "User-Agent": "ELTARA-Link-Health/1.0", Range: "bytes=0-1023" }
        : { "User-Agent": "ELTARA-Link-Health/1.0" }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeOne(input: string, timeoutMs: number, maxRedirects: number): Promise<ExternalLinkProbeResult> {
  let current = safeHttpsUrl(input);
  if (!current) {
    return { url: input, checked: false, reachable: false, status: null, reason: "unsafe" };
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (!(await hostIsPublic(current))) {
      return { url: input, checked: false, reachable: false, status: null, reason: "unsafe" };
    }

    try {
      let response = await requestOnce(current, "HEAD", timeoutMs);
      if (response.status === 405 || response.status === 501) {
        response = await requestOnce(current, "GET", timeoutMs);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === maxRedirects) {
          return { url: input, checked: true, reachable: false, status: response.status, reason: "http" };
        }
        const next = safeHttpsUrl(new URL(location, current).toString());
        if (!next) {
          return { url: input, checked: false, reachable: false, status: response.status, reason: "unsafe" };
        }
        current = next;
        continue;
      }

      return {
        url: input,
        checked: true,
        reachable: reachableStatus(response.status),
        status: response.status,
        reason: reachableStatus(response.status) ? "ok" : "http"
      };
    } catch {
      return { url: input, checked: true, reachable: false, status: null, reason: "network" };
    }
  }

  return { url: input, checked: true, reachable: false, status: null, reason: "http" };
}

export async function probeHttpsLinks(
  links: string[],
  options: { maxLinks?: number; timeoutMs?: number; maxRedirects?: number } = {}
) {
  const maxLinks = Math.max(0, Math.min(options.maxLinks ?? 4, 8));
  const timeoutMs = Math.max(500, Math.min(options.timeoutMs ?? 3500, 8000));
  const maxRedirects = Math.max(0, Math.min(options.maxRedirects ?? 3, 5));
  const unique = Array.from(new Set(links.map((link) => link.trim()).filter(Boolean))).slice(0, maxLinks);
  return Promise.all(unique.map((link) => probeOne(link, timeoutMs, maxRedirects)));
}
