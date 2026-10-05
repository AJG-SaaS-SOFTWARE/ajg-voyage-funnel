import { NextRequest, NextResponse } from "next/server";

const rootDomain=process.env.NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN||"voyage.ajgsolutionsgroup.com";
const appHostname=(process.env.NEXT_PUBLIC_SITE_BUILDER_URL||"https://eltara.ajgsolutionsgroup.com").replace(/^https?:\/\//,"").replace(/\/.*$/,"").toLowerCase();
const reservedSubdomains=new Set(["www","app","builder","admin"]);

export function middleware(request:NextRequest){
 const hostname=(request.headers.get("host")||"").split(":")[0].toLowerCase();
 if(!hostname)return NextResponse.next();
 const suffix="."+rootDomain;
 if(hostname.endsWith(suffix)){
   const slug=hostname.slice(0,-suffix.length);
   if(!slug||slug.includes(".")||reservedSubdomains.has(slug))return NextResponse.next();
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
 const isAppHost=hostname===appHostname||hostname===rootDomain||hostname==="localhost"||hostname.endsWith(".vercel.app");
 if(isAppHost){
   const response=NextResponse.next();
   if(request.nextUrl.pathname==="/pricing")response.headers.set("Content-Language","en");
   if(request.nextUrl.pathname==="/tarifs")response.headers.set("Content-Language","fr");
   return response;
 }
 const url=request.nextUrl.clone();
 url.pathname="/domain/"+encodeURIComponent(hostname)+(request.nextUrl.pathname==="/"?"":request.nextUrl.pathname);
 return NextResponse.rewrite(url);
}

export const config={matcher:["/((?!api|_next/static|_next/image|favicon.ico|domain/).*)"]};
