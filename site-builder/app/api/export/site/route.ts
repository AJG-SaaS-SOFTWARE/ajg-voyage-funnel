import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function bearer(request: Request) {
 const value=request.headers.get("authorization")||"";
 return value.startsWith("Bearer ")?value.slice(7):"";
}

export async function GET(request: Request) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!publishable||!serviceKey) return NextResponse.json({error:"Export service not configured"},{status:503});
 const token=bearer(request); if(!token) return NextResponse.json({error:"Unauthorized"},{status:401});
 const userClient=createClient(url,publishable,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await userClient.auth.getUser(token);
 if(userError||!user) return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:sites,error:siteError}=await userClient.from("sites").select("id,slug,status,updated_at,site_config").eq("owner_id",user.id).order("updated_at",{ascending:false}).limit(1);
 if(siteError||!sites?.[0]) return NextResponse.json({error:"Site unavailable"},{status:404});
 const site=sites[0];
 const {data:caps,error:capError}=await userClient.rpc("get_my_site_capabilities",{p_site_id:site.id});
 const cap=Array.isArray(caps)?caps[0]:caps;
 if(capError||!cap?.can_export) return NextResponse.json({error:"Export unavailable"},{status:403});
 const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const prefix=`${user.id}/${site.id}`;
 const listed=await service.storage.from("site-media").list(prefix,{limit:1000,sortBy:{column:"name",order:"asc"}});
 const media=(listed.data||[]).filter(item=>item.name&&item.id).map(item=>{
   const path=`${prefix}/${item.name}`;
   const {data}=service.storage.from("site-media").getPublicUrl(path);
   return {path,name:item.name,size:item.metadata?.size??null,mimeType:item.metadata?.mimetype??null,url:data.publicUrl};
 });
 const {data:domains}=await service.from("domains").select("hostname,kind,verification_status,is_primary").eq("site_id",site.id);
 return NextResponse.json({format:"ajg-builder-export-v2",exportedAt:new Date().toISOString(),site:{id:site.id,slug:site.slug,status:site.status,updatedAt:site.updated_at,config:site.site_config},domains:domains||[],media,note:"Export de récupération : configuration, domaines et inventaire des médias conservés. Les URL média permettent de récupérer les fichiers tant qu’ils restent conservés."},{headers:{"Cache-Control":"private, no-store"}});
}
