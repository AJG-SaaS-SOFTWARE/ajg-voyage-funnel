import { headers } from "next/headers";

export async function publicRouteBase(slug: string) {
  const requestHeaders = await headers();
  return requestHeaders.get("x-ajg-clean-public") === "1" ? "" : `/site/${encodeURIComponent(slug)}`;
}
