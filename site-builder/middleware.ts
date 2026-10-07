import { NextRequest, NextResponse } from "next/server";
import { managedSlugFromHostname, publishedRootDomains } from "./lib/published-domain";

const appHostname=(process.env.NEXT_PUBLIC_SITE_BUILDER_URL||process.env.NEXT_PUBLIC_APP_URL||"https://eltara.ajgsolutionsgroup.com").replace(/^https?:\/\//,"").replace(/\/.*$/,"").toLowerCase();
const reservedSubdomains=new Set(["www","app","builder","admin"]);

export function middleware(request:NextRequest){
 const hostname=(request.headers.get("host")||"").split(":")[0].toLowerCase();
 if(!hostname)return NextResponse.next();
 const managedSlug=managedSlugFromHostname(hostname);
 if(managedSlug){
   const slug=managedSlug;
   if(reservedSubdomains.has(slug))return NextResponse.next();
   const url=request.nextUrl.clone();
   const legacyPrefix="/site/"+encodeURIComponent(slug);
   if(request.nextUrl.pathname===legacyPrefix||request.nextUrl.pathname.startsWith(legacyPrefix+"/")){
     url.pathname=request.nextUrl.pathname.slice(legacyPrefix.length)||"/";
     return NextResponse.redirect(url,308);
   }
   url.pathname="/site/"+encodeURIComponent(slug)+(request.nextUrl.pathname==="/"?"":request.nextUrl.pathname);
   const requestHeaders=new Headers(request.headers);requestHeaders.set("x-ajg-clean-public","1");
   return NextResponse.rewrite(url,{request:{headers:requestHeaders}});
 }
 const legacyAppHostname="ajg-site-builder.vercel.app";
 if(hostname===legacyAppHostname&&appHostname!==legacyAppHostname){
   const url=request.nextUrl.clone();
   url.protocol="https:";
   url.hostname=appHostname;
   url.port="";
   return NextResponse.redirect(url,308);
 }
 const isAppHost=hostname===appHostname||publishedRootDomains().includes(hostname)||hostname==="localhost"||hostname.endsWith(".vercel.app");
 if(isAppHost){
   const explicitLocale=request.nextUrl.pathname==="/pricing"?"en":request.nextUrl.pathname==="/tarifs"?"fr":null;
   if(explicitLocale){
     const requestHeaders=new Headers(request.headers);
     requestHeaders.set("x-ajg-product-locale",explicitLocale);
     const response=NextResponse.next({request:{headers:requestHeaders}});
     response.headers.set("Content-Language",explicitLocale);
     return response;
   }
   return NextResponse.next();
 }
 const url=request.nextUrl.clone();
 url.pathname="/domain/"+encodeURIComponent(hostname)+(request.nextUrl.pathname==="/"?"":request.nextUrl.pathname);
 return NextResponse.rewrite(url);
}

export const config={matcher:["/((?!api|_next/static|_next/image|favicon.ico|domain/).*)"]};
