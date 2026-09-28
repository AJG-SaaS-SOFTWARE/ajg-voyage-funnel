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
 const {data:domain}=await userClient.from("domains").select("id,hostname,kind,verification_status").eq("id",body.domainId).eq("site_id",body.siteId).maybeSingle();if(!domain)return NextResponse.json({error:"Domain unavailable"},{status:404});
 if(domain.kind==="custom_domain"){const {data:ent}=await userClient.rpc("get_my_site_entitlements",{p_site_id:body.siteId});const e=Array.isArray(ent)?ent[0]:ent;if(!e?.custom_domain)return NextResponse.json({error:"Custom domain unavailable"},{status:403});}
 if(domain.kind!=="custom_domain"&&domain.kind!=="managed_subdomain")return NextResponse.json({error:"Unsupported domain kind"},{status:400});
 const endpoint=`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains?teamId=${encodeURIComponent(team)}`;
 let res=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name:domain.hostname})});
 let result=await res.json().catch(()=>({}));
 if(!res.ok && res.status!==400)return NextResponse.json({error:"Unable to attach domain",details:result},{status:502});
 const verify=await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(domain.hostname)}/verify?teamId=${encodeURIComponent(team)}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}});
 const verification=await verify.json().catch(()=>({}));
 const ownershipVerified=Boolean(verification?.verified);
 const configRes=await fetch(`https://api.vercel.com/v6/domains/${encodeURIComponent(domain.hostname)}/config?projectIdOrName=${encodeURIComponent(project)}&teamId=${encodeURIComponent(team)}`,{headers:{Authorization:`Bearer ${token}`,"Accept":"application/json"}});
 const config=await configRes.json().catch(()=>({}));
 const verified=ownershipVerified&&configRes.ok&&config?.misconfigured===false;
 const dnsInstructions:Array<{type?:string;domain?:string;value?:string;reason?:string}>=[];
 const addValues=(type:string,items:unknown)=>{if(!Array.isArray(items))return;for(const item of items){const value=typeof item==="string"?item:(item as any)?.value||(item as any)?.target||(item as any)?.cname||(item as any)?.address;if(value)dnsInstructions.push({type,domain:domain.hostname,value:String(value)});}};
 addValues("CNAME",config?.recommendedCNAME);
 addValues("A",config?.recommendedIPv4);
 if(config?.misconfigured===true&&!dnsInstructions.length)dnsInstructions.push({type:"DNS",domain:domain.hostname,reason:"Configuration DNS Vercel encore incomplète."});
 const service=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
 if(verified){
   if(domain.kind==="custom_domain"){
     await service.from("domains").update({is_primary:false}).eq("site_id",body.siteId);
     await service.from("domains").update({verification_status:"verified",is_primary:true}).eq("id",domain.id);
   }else{
     const {data:verifiedCustom}=await service.from("domains").select("id").eq("site_id",body.siteId).eq("kind","custom_domain").eq("verification_status","verified").limit(1).maybeSingle();
     if(!verifiedCustom){
       await service.from("domains").update({is_primary:false}).eq("site_id",body.siteId);
       await service.from("domains").update({verification_status:"verified",is_primary:true}).eq("id",domain.id);
     }else{
       await service.from("domains").update({verification_status:"verified",is_primary:false}).eq("id",domain.id);
     }
   }
 }else{
   await service.from("domains").update({verification_status:"pending",is_primary:false}).eq("id",domain.id);
 }
 return NextResponse.json({ok:true,verified,ownershipVerified,misconfigured:config?.misconfigured??null,verification:verified?[]:(dnsInstructions.length?dnsInstructions:(verification?.verification||result?.verification||[]))});
}
