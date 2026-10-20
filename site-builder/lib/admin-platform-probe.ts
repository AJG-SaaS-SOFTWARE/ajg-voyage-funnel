import { resolveAny } from "node:dns/promises";

export type PlatformProbe = {
  host: string;
  dns: "ok" | "nxdomain" | "error";
  https: "ok" | "unavailable" | "skipped";
  httpStatus: number | null;
};

const maxHealthBytes = 16 * 1024;

async function confirmedApplicationHealth(response: Response) {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) return false;
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) > maxHealthBytes) return false;
  const reader = response.body?.getReader();
  if (!reader) return false;
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxHealthBytes) return false;
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    return body?.ok === true && body?.service === "ajg-site-builder" &&
      body?.database === "ok" && body?.environment === "production";
  } catch {
    return false;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// These are the existing configured platform hosts, not customer-provided URLs.
// The canary checks HTTP reachability; /api/health additionally needs the real
// application contract. Neither a redirect nor a login/error page is evidence.
export async function platformProbe(host: string, path: "/" | "/api/health" = "/"): Promise<PlatformProbe> {
  let dns: PlatformProbe["dns"] = "ok";
  try {
    await resolveAny(host);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    dns = code === "ENOTFOUND" || code === "ENODATA" ? "nxdomain" : "error";
  }
  if (dns !== "ok") return { host, dns, https: "skipped", httpStatus: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let httpStatus: number | null = null;
  try {
    const response = await fetch(`https://${host}${path}`, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "ELTARA-Platform-Health/1.0" }
    });
    httpStatus = response.status;
    const ok = response.status === 200 &&
      (path === "/" || await confirmedApplicationHealth(response));
    // No body is needed for canaries or refused status/content-type responses.
    if (!response.bodyUsed) await response.body?.cancel().catch(() => {});
    return { host, dns, https: ok ? "ok" : "unavailable", httpStatus };
  } catch {
    return { host, dns, https: "unavailable", httpStatus };
  } finally {
    clearTimeout(timeout);
  }
}
