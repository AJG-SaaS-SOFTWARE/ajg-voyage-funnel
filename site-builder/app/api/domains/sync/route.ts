import { NextRequest,NextResponse } from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
const project=process.env.VERCEL_PROJECT_ID||"prj_RUtVL1fXzOqY8dHetb6U2dp07Ygn";
const team=process.env.VERCEL_TEAM_ID||"team_T1xBMzY6HJCAkUStrmkUgj60";
type Body={siteId?:string;domainId?:string};
export async function POST(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,serverKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,token=process.env.VERCEL_TOKEN;
 if(!url||!publicKey||!serverKey||!token)return NextResponse.json({error:"Domain automation not configured"},{status:503});
 const bearer=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!bearer)return NextResponse.json({error:"Unauthorized"},{status:401});
 const userClient=createClient(url,publicKey,{global:{headers:{Authorization:`Bearer ${bearer}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user}}=await userClient.auth.getUser(bearer);if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json() as Body;if(!body.siteId||!body.domainId)return NextResponse.json({error:"Invalid domain request"},{status:400});
 const {data:site}=await userClient.from("sites").select("id").eq("id",body.siteId).eq("owner_id",user.id).maybeSingle();if(!site)return NextResponse.json({error:"Site unavailable"},{status:404});
 const {data:ent}=await userClient.rpc("get_my_site_entitlements",{p_site_id:body.siteId});const e=Array.isArray(ent)?ent[0]:ent;if(!e?.custom_domain)return NextResponse.json({error:"Custom domain unavailable"},{status:403});
 const {data:domain}=await userClient.from("domains").select("id,hostname,kind,verification_status").eq("id",body.domainId).eq("site_id",body.siteId).eq("kind","custom_domain").maybeSingle();if(!domain)return NextResponse.json({error:"Domain unavailable"},{status:404});
 const endpoint=`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains?teamId=${encodeURIComponent(team)}`;
 let res=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name:domain.hostname})});
 let result=await res.json().catch(()=>({}));
 if(!res.ok && res.status!==400)return NextResponse.json({error:"Unable to attach domain",details:result},{status:502});
 const verify=await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(domain.hostname)}/verify?teamId=${encodeURIComponent(team)}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}});
 const verification=await verify.json().catch(()=>({}));
 const verified=Boolean(verification?.verified);
 const service=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
 await service.from("domains").update({verification_status:verified?"verified":"pending",is_primary:verified}).eq("id",domain.id);
 return NextResponse.json({ok:true,verified,verification:verified?[]:(verification?.verification||result?.verification||[])});
}
