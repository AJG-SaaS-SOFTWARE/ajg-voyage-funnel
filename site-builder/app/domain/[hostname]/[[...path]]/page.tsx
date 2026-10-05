import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedSite from "../../../../components/PublishedSite";
import { CookiesPage, LegalNoticePage, PrivacyPage } from "../../../../components/SiteLegalPages";
import { getPublicSiteByHostname } from "../../../../lib/public-site";
import { buildPublicMetadata, legalMetadataLabel } from "../../../../lib/public-metadata";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{hostname:string;path?:string[]}>}):Promise<Metadata>{
 const {hostname,path=[]}=await params;
 const decoded=decodeURIComponent(hostname);
 const site=await getPublicSiteByHostname(decoded);
 if(!site)return {title:"Website not found / Site introuvable | ELTARA",robots:{index:false,follow:false}};

 const suffix=path.map(encodeURIComponent).join("/");
 const canonical="https://"+decoded+(suffix?"/"+suffix:"");
 const legalPath=path[0]&&["mentions-legales","confidentialite","cookies"].includes(path[0])
   ? path[0] as "mentions-legales"|"confidentialite"|"cookies"
   : null;

 if(legalPath){
   return buildPublicMetadata(site.config,{canonical,pageTitle:legalMetadataLabel(site.config,legalPath),index:false});
 }

 if(path[0]==="p"&&path[1]){
   const pageSlug=decodeURIComponent(path[1]);
   const page=site.config.architecture.mode==="multi"
     ? site.config.architecture.pages.find((item)=>item.enabled&&item.slug===pageSlug)
     : undefined;
   if(!page)return {title:`${site.config.language==="en"?"Page not found":"Page introuvable"} | ELTARA`,robots:{index:false,follow:false}};
   return buildPublicMetadata(site.config,{canonical,pageTitle:page.title});
 }

 if(path.length)return {title:`${site.config.language==="en"?"Page not found":"Page introuvable"} | ELTARA`,robots:{index:false,follow:false}};
 return buildPublicMetadata(site.config,{canonical});
}

export default async function CustomDomainPage({params}:{params:Promise<{hostname:string;path?:string[]}>}){
 const {hostname,path=[]}=await params;const site=await getPublicSiteByHostname(decodeURIComponent(hostname));if(!site)notFound();
 if(path[0]==="mentions-legales")return <LegalNoticePage config={site.config} routeBase="" />;
 if(path[0]==="confidentialite")return <PrivacyPage config={site.config} routeBase="" />;
 if(path[0]==="cookies")return <CookiesPage config={site.config} routeBase="" />;
 if(path[0]==="p"&&path[1])return <PublishedSite config={site.config} siteId={site.id} pageSlug={decodeURIComponent(path[1])} routeBase="" />;
 if(path.length)notFound();
 return <PublishedSite config={site.config} siteId={site.id} routeBase="" />;
}
