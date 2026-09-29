import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { localize, requestProductLocale } from "../../../../lib/server-locale";

export const runtime = "nodejs";

type Body={siteId?:string;privateRef?:string;assetId?:string;rights?:"owned"|"licensed"|"public-domain"|"unknown";sourceUrl?:string};

export async function POST(request:NextRequest){
 const locale=requestProductLocale(request),tr=(fr:string,en:string)=>localize(locale,fr,en);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const serverKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!publicKey||!serverKey)return NextResponse.json({error:tr("Stockage indisponible.","Storage unavailable.")},{status:503});
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return NextResponse.json({error:tr("Reconnectez-vous pour continuer.","Sign in again to continue.")},{status:401});
 const userClient=createClient(url,publicKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await userClient.auth.getUser(token);
 if(userError||!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json() as Body;
 if(!body.siteId||!body.privateRef?.startsWith("private://")||!body.assetId)return NextResponse.json({error:tr("Demande média invalide.","Invalid media request.")},{status:400});
 if(body.rights==="unknown"||!body.rights)return NextResponse.json({error:tr("Les droits de publication doivent être confirmés.","Publication rights must be confirmed.")},{status:409});
 if((body.rights==="licensed"||body.rights==="public-domain")&&!body.sourceUrl?.trim())return NextResponse.json({error:tr("Une source ou licence vérifiable est requise.","A verifiable source or license is required.")},{status:409});
 const {data:site}=await userClient.from("sites").select("id").eq("id",body.siteId).eq("owner_id",user.id).maybeSingle();
 if(!site)return NextResponse.json({error:tr("Site indisponible.","Website unavailable.")},{status:404});
 const {data:caps,error:capError}=await userClient.rpc("get_my_site_capabilities",{p_site_id:body.siteId});
 const cap=Array.isArray(caps)?caps[0]:caps;
 if(capError||!cap?.can_publish)return NextResponse.json({error:tr("Publication indisponible pour ce site.","Publishing is unavailable for this website.")},{status:403});
 const source=body.privateRef.slice("private://".length);
 const expectedPrefix=`${user.id}/${body.siteId}/library/`;
 if(!source.startsWith(expectedPrefix))return NextResponse.json({error:tr("Ce média n’appartient pas à cet espace.","This media does not belong to this workspace.")},{status:403});
 const ext=(source.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();
 const destination=`${user.id}/${body.siteId}/published/${body.assetId}.${ext}`;
 const service=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error:removeError}=await service.storage.from("site-media").remove([destination]);
 if(removeError && !/not found/i.test(removeError.message)) return NextResponse.json({error:tr("Impossible de préparer la destination du média.","Unable to prepare the media destination.")},{status:500});
 const {error:copyError}=await service.storage.from("site-private-media").copy(source,destination,{destinationBucket:"site-media"});
 if(copyError)return NextResponse.json({error:tr("Impossible de préparer le média pour publication.","Unable to prepare the media for publishing.")},{status:500});
 const publicUrl=service.storage.from("site-media").getPublicUrl(destination).data.publicUrl;
 return NextResponse.json({url:publicUrl,path:destination});
}
