import { NextRequest, NextResponse } from "next/server";

const rootDomain =
  process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN || "voyage.ajgsolutionsgroup.com";

const reservedSubdomains = new Set(["www", "app", "builder", "admin"]);

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();

  if (!hostname || request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  const suffix = "." + rootDomain;
  if (!hostname.endsWith(suffix)) {
    return NextResponse.next();
  }

  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes(".") || reservedSubdomains.has(slug)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/site/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/"]
};
