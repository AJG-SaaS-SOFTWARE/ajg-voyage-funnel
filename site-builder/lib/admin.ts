import { getSupabaseBrowserClient } from "./supabase-browser";

export type AdminSiteRow = { id:string; ownerId:string; slug:string; status:string; updatedAt:string; planKey:string; subscriptionStatus:string; customDomain:string; domainStatus:string };

export async function isCurrentUserAdmin() {
  const supabase=getSupabaseBrowserClient(); if(!supabase) return false;
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return false;
  const {data,error}=await supabase.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(error) throw error; return data?.role==="admin";
}

export async function getAdminSites():Promise<AdminSiteRow[]> {
  const supabase=getSupabaseBrowserClient(); if(!supabase) return [];
  if(!await isCurrentUserAdmin()) throw new Error("Accès administrateur requis.");
  const [{data:sites,error:sitesError},{data:subs,error:subsError},{data:domains,error:domainsError}]=await Promise.all([
    supabase.from("sites").select("id,owner_id,slug,status,updated_at").order("updated_at",{ascending:false}),
    supabase.from("user_subscriptions").select("user_id,plan_key,status"),
    supabase.from("domains").select("site_id,hostname,kind,verification_status,is_primary")
  ]);
  if(sitesError) throw sitesError;if(subsError) throw subsError;if(domainsError) throw domainsError;
  return (sites||[]).map((site:any)=>{const sub=(subs||[]).find((x:any)=>x.user_id===site.owner_id);const domain=(domains||[]).find((x:any)=>x.site_id===site.id&&x.kind==="custom_domain");
    return {id:site.id,ownerId:site.owner_id,slug:site.slug,status:site.status,updatedAt:site.updated_at,planKey:sub?.plan_key||"free",subscriptionStatus:sub?.status||"active",customDomain:domain?.hostname||"",domainStatus:domain?.verification_status||""};});
}

export async function adminSetPlan(userId:string,planKey:"free"|"pro"){
  const supabase=getSupabaseBrowserClient();if(!supabase) throw new Error("Supabase n'est pas configuré.");
  if(!await isCurrentUserAdmin()) throw new Error("Accès administrateur requis.");
  const {error}=await supabase.from("user_subscriptions").upsert({user_id:userId,plan_key:planKey,status:"active",updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if(error) throw error;
}

export type AdminMetrics={events30d:number;publishes30d:number;architectApplies30d:number;feedbackOpen:number};
export type AdminFeedback={id:string;category:string;rating:number|null;message:string;status:string;createdAt:string};

export async function getAdminMetrics():Promise<AdminMetrics>{
 const supabase=getSupabaseBrowserClient();if(!supabase||!await isCurrentUserAdmin())throw new Error("Accès administrateur requis.");
 const since=new Date(Date.now()-30*24*60*60*1000).toISOString();
 const [events,publishes,architect,feedback]=await Promise.all([
  supabase.from("product_events").select("*",{count:"exact",head:true}).gte("created_at",since),
  supabase.from("product_events").select("*",{count:"exact",head:true}).eq("event_name","publish_success").gte("created_at",since),
  supabase.from("product_events").select("*",{count:"exact",head:true}).in("event_name",["architect_applied","revision_applied"]).gte("created_at",since),
  supabase.from("user_feedback").select("*",{count:"exact",head:true}).in("status",["new","reviewed","planned"])
 ]);
 for(const result of [events,publishes,architect,feedback])if(result.error)throw result.error;
 return {events30d:events.count||0,publishes30d:publishes.count||0,architectApplies30d:architect.count||0,feedbackOpen:feedback.count||0};
}

export async function getAdminFeedback():Promise<AdminFeedback[]>{
 const supabase=getSupabaseBrowserClient();if(!supabase||!await isCurrentUserAdmin())throw new Error("Accès administrateur requis.");
 const {data,error}=await supabase.from("user_feedback").select("id,category,rating,message,status,created_at").order("created_at",{ascending:false}).limit(50);
 if(error)throw error;return (data||[]).map((x:any)=>({id:x.id,category:x.category,rating:x.rating,message:x.message,status:x.status,createdAt:x.created_at}));
}
