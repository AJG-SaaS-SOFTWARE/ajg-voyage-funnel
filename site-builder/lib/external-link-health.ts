import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ExternalLinkProbeResult = {
  url: string;
  status: number | null;
  state: "reachable" | "unreachable" | "unsafe";
};

export type ExternalLinkProbeSummary = {
  configured: number;
  checked: number;
  reachable: number;
  unreachable: number;
  unsafe: number;
};

type Resolver = (hostname: string) => Promise<Array<{ address: string }>>;
type Fetcher = typeof fetch;

function ipv4Parts(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

export function isPublicIpAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const parts = ipv4Parts(address);
    if (!parts) return false;
    const [a, b] = parts;
    if (
      a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224
    ) return false;
    return true;
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    if (
      normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe8")
      || normalized.startsWith("fe9")
      || normalized.startsWith("fea")
      || normalized.startsWith("feb")
      || normalized.startsWith("ff")
    ) return false;

    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIpAddress(mapped[1]);
    return true;
  }

  return false;
}

export function isUnsafeExternalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (
    !normalized
    || normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized.endsWith(".local")
    || normalized.endsWith(".internal")
    || normalized.endsWith(".home.arpa")
  );
}

async function defaultResolver(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

async function destinationIsPublic(url: URL, resolver: Resolver) {
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  if (isUnsafeExternalHostname(url.hostname)) return false;

  if (isIP(url.hostname)) return isPublicIpAddress(url.hostname);

  try {
    const addresses = await resolver(url.hostname);
    return addresses.length > 0 && addresses.every((item) => isPublicIpAddress(item.address));
  } catch {
    return false;
  }
}

function reachableStatus(status: number) {
  return (status >= 200 && status < 400) || [401, 403, 405, 429].includes(status);
}

function redirectStatus(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

export async function probeExternalLink(
  rawUrl: string,
  options?: { resolver?: Resolver; fetcher?: Fetcher; timeoutMs?: number; maxRedirects?: number }
): Promise<ExternalLinkProbeResult> {
  const resolver = options?.resolver || defaultResolver;
  const fetcher = options?.fetcher || fetch;
  const timeoutMs = Math.min(Math.max(options?.timeoutMs || 3500, 500), 8000);
  const maxRedirects = Math.min(Math.max(options?.maxRedirects ?? 4, 0), 6);

  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { url: rawUrl, status: null, state: "unsafe" };
  }

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (!(await destinationIsPublic(current, resolver))) {
      return { url: current.toString(), status: null, state: "unsafe" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(current.toString(), {
        method: "GET",
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "ELTARA-Link-Health/1.0",
          Range: "bytes=0-0",
          Accept: "text/html,application/xhtml+xml,*/*;q=0.5"
        }
      });
      void response.body?.cancel().catch(() => undefined);

      if (redirectStatus(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirectCount === maxRedirects) {
          return { url: current.toString(), status: response.status, state: "unreachable" };
        }
        try {
          current = new URL(location, current);
        } catch {
          return { url: current.toString(), status: response.status, state: "unreachable" };
        }
        continue;
      }

      return {
        url: current.toString(),
        status: response.status,
        state: reachableStatus(response.status) ? "reachable" : "unreachable"
      };
    } catch {
      return { url: current.toString(), status: null, state: "unreachable" };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { url: current.toString(), status: null, state: "unreachable" };
}

export async function probeExternalLinks(urls: string[]): Promise<ExternalLinkProbeSummary> {
  const unique = Array.from(new Set(urls)).slice(0, 4);
  const results = await Promise.all(unique.map((url) => probeExternalLink(url)));
  return results.reduce<ExternalLinkProbeSummary>(
    (summary, result) => {
      summary.checked += 1;
      summary[result.state] += 1;
      return summary;
    },
    {
      configured: unique.length,
      checked: 0,
      reachable: 0,
      unreachable: 0,
      unsafe: 0
    }
  );
}
