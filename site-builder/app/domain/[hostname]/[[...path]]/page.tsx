import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedSite from "../../../../components/PublishedSite";
import { CookiesPage, LegalNoticePage, PrivacyPage } from "../../../../components/SiteLegalPages";
import { getPublicSiteByHostname } from "../../../../lib/public-site";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{hostname:string;path?:string[]}>}):Promise<Metadata>{
 const {hostname,path=[]}=await params;const decoded=decodeURIComponent(hostname);const site=await getPublicSiteByHostname(decoded);if(!site)return {title:"Site introuvable | AJG",robots:{index:false,follow:false}};
 const legal=Boolean(path[0]&&["mentions-legales","confidentialite","cookies"].includes(path[0]));
 const page=path[0]==="p"&&path[1]?site.config.architecture.pages.find((item)=>item.enabled&&item.slug===decodeURIComponent(path[1])):null;
 const title=page?(page.title+" | "+site.config.brandName):site.config.brandName+" | "+(legal?path[0]:"Voyage");
 const description=page?(page.intro||page.sections.find((section)=>section.text.trim())?.text.slice(0,160)||site.config.heroSubtitle):site.config.heroSubtitle||("Découvrez le site de "+site.config.firstName+" "+site.config.lastName+".");
 const suffix=path.map(encodeURIComponent).join("/");const canonical=("https://"+decoded+(suffix?"/"+suffix:""));
 return {title,description,alternates:{canonical},robots:{index:!legal,follow:true},openGraph:{title,description,url:canonical,type:"website"}};
}

export default async function CustomDomainPage({params}:{params:Promise<{hostname:string;path?:string[]}>}){
 const {hostname,path=[]}=await params;const site=await getPublicSiteByHostname(decodeURIComponent(hostname));if(!site)notFound();
 if(path[0]==="mentions-legales")return <LegalNoticePage config={site.config} routeBase="" />;
 if(path[0]==="confidentialite")return <PrivacyPage config={site.config} routeBase="" />;
 if(path[0]==="cookies")return <CookiesPage config={site.config} routeBase="" />;
 if(path[0]==="p"&&path[1])return <PublishedSite config={site.config} pageSlug={decodeURIComponent(path[1])} routeBase="" />;
 if(path.length)notFound();
 return <PublishedSite config={site.config} routeBase="" />;
}
