import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {localize,requestProductLocale} from "../../../../lib/server-locale";
export const runtime="nodejs";
const project=process.env.VERCEL_PROJECT_ID||"prj_RUtVL1fXzOqY8dHetb6U2dp07Ygn",team=process.env.VERCEL_TEAM_ID||"team_T1xBMzY6HJCAkUStrmkUgj60";
export async function POST(request:NextRequest){
 const locale=requestProductLocale(request),tr=(fr:string,en:string)=>localize(locale,fr,en);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,serverKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,vercel=process.env.VERCEL_TOKEN;
 if(!url||!key||!serverKey||!vercel)return NextResponse.json({error:tr("Automatisation des domaines non configurée.","Domain automation is not configured.")},{status:503});
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return NextResponse.json({error:tr("Reconnectez-vous pour continuer.","Sign in again to continue.")},{status:401});
 const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});const {data:{user}}=await client.auth.getUser(token);if(!user)return NextResponse.json({error:tr("Connexion requise.","Sign-in required.")},{status:401});
 const {domainId}=await request.json() as {domainId?:string};if(!domainId)return NextResponse.json({error:tr("Demande de domaine invalide.","Invalid domain request.")},{status:400});
 const {data:domain}=await client.from("domains").select("id,hostname,site_id,kind").eq("id",domainId).eq("kind","custom_domain").maybeSingle();if(!domain)return NextResponse.json({error:tr("Domaine indisponible.","Domain unavailable.")},{status:404});
 const {data:site}=await client.from("sites").select("id").eq("id",domain.site_id).eq("owner_id",user.id).maybeSingle();if(!site)return NextResponse.json({error:tr("Domaine indisponible.","Domain unavailable.")},{status:404});
 const response=await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(domain.hostname)}?teamId=${encodeURIComponent(team)}`,{method:"DELETE",headers:{Authorization:`Bearer ${vercel}`,"Content-Type":"application/json"}});
 if(!response.ok&&response.status!==404)return NextResponse.json({error:tr("Impossible de détacher le domaine.","Unable to detach domain.")},{status:502});
 const service=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await service.from("domains").delete().eq("id",domain.id);if(error)return NextResponse.json({error:tr("Impossible de supprimer le domaine.","Unable to remove domain.")},{status:500});
 return NextResponse.json({ok:true});
}