import { getProductLocale } from "./product-i18n";
import { getSupabaseBrowserClient } from "./supabase-browser";

export type ProductEventName="builder_open"|"onboarding_manual_selected"|"onboarding_ai_selected"|"beta_essential_selected"|"beta_growth_selected"|"beta_growth_cockpit_opened"|"beta_analytics_opened"|"step_identity"|"step_story"|"step_design"|"step_booking"|"step_options"|"step_review"|"architect_generated"|"architect_regenerated"|"architect_refined"|"architect_failed"|"architect_applied"|"revision_applied"|"publish_success";
export type FeedbackCategory="bug"|"idea"|"usability"|"quality"|"other";
export type ArchitectQualityReason="need_mismatch"|"copy"|"structure"|"design"|"generic"|"other";
export type BetaJourneyProgress={
 essentialTested:boolean;
 growthTested:boolean;
 essentialThenGrowth:boolean;
 growthCockpitOpened:boolean;
 analyticsOpened:boolean;
 growthExplored:boolean;
 published:boolean;
 feedbackSent:boolean;
};

function clientTr(fr:string,en:string){
 return getProductLocale()==="en"?en:fr;
}

export async function trackProductEvent(eventName:ProductEventName,siteId?:string|null){
 const supabase=getSupabaseBrowserClient();if(!supabase)return;
 const {data:{user}}=await supabase.auth.getUser();if(!user)return;
 const {error}=await supabase.from("product_events").insert({user_id:user.id,site_id:siteId||null,event_name:eventName});
 if(error) console.warn("AJG product event unavailable",error.message);
}

export async function getMyBetaJourneyProgress(siteId?:string|null):Promise<BetaJourneyProgress>{
 const supabase=getSupabaseBrowserClient();
 const empty={essentialTested:false,growthTested:false,essentialThenGrowth:false,growthCockpitOpened:false,analyticsOpened:false,growthExplored:false,published:false,feedbackSent:false};
 if(!supabase)return empty;
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return empty;
 const [{data:events,error:eventError},{data:feedback,error:feedbackError}]=await Promise.all([
  supabase
   .from("product_events")
   .select("event_name,site_id,created_at")
   .in("event_name",["beta_essential_selected","beta_growth_selected","beta_growth_cockpit_opened","beta_analytics_opened","publish_success"])
   .order("created_at",{ascending:true}),
  siteId
   ? supabase.from("user_feedback").select("id").eq("site_id",siteId).limit(1)
   : supabase.from("user_feedback").select("id").limit(1)
 ]);
 if(eventError||feedbackError)return empty;
 const rows=events||[];
 const essential=rows.filter((item)=>item.event_name==="beta_essential_selected");
 const growth=rows.filter((item)=>item.event_name==="beta_growth_selected");
 const essentialThenGrowth=essential.some((essentialEvent)=>{
  const essentialAt=Date.parse(String(essentialEvent.created_at||""));
  if(!Number.isFinite(essentialAt))return false;
  return growth.some((growthEvent)=>{
   const growthAt=Date.parse(String(growthEvent.created_at||""));
   return Number.isFinite(growthAt)&&growthAt>=essentialAt;
  });
 });
 const published=rows.some((item)=>item.event_name==="publish_success"&&(!siteId||item.site_id===siteId));
 const growthCockpitOpened=rows.some((item)=>item.event_name==="beta_growth_cockpit_opened"&&(!siteId||item.site_id===siteId));
 const analyticsOpened=rows.some((item)=>item.event_name==="beta_analytics_opened"&&(!siteId||item.site_id===siteId));
 return {
  essentialTested:essential.length>0,
  growthTested:growth.length>0,
  essentialThenGrowth,
  growthCockpitOpened,
  analyticsOpened,
  growthExplored:growthCockpitOpened&&analyticsOpened,
  published,
  feedbackSent:Boolean(feedback?.length)
 };
}

export async function submitFeedback(input:{category:FeedbackCategory;rating?:number;message:string;siteId?:string|null}){
 const supabase=getSupabaseBrowserClient();if(!supabase)throw new Error(clientTr("Supabase n’est pas configuré.","Supabase is not configured."));
 const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error(clientTr("Connexion requise.","Sign in required."));
 const message=input.message.trim();if(message.length<3)throw new Error(clientTr("Ajoutez quelques mots pour nous aider à comprendre.","Add a few words so we can understand your feedback."));
 const {error}=await supabase.from("user_feedback").insert({user_id:user.id,site_id:input.siteId||null,category:input.category,rating:input.rating||null,message:message.slice(0,2000),status:"new"});
 if(error)throw new Error(clientTr("Impossible d’enregistrer votre retour pour le moment.","Unable to save your feedback right now."));
}


export async function submitArchitectQualityFeedback(input:{
 proposalKey:string;
 siteId:string;
 verdict:"positive"|"negative";
 reason?:ArchitectQualityReason|null;
 attemptKind:"first"|"regeneration";
 auditScore:number;
 refinementApplied:boolean;
}){
 const supabase=getSupabaseBrowserClient();
 if(!supabase)throw new Error(clientTr("Supabase n’est pas configuré.","Supabase is not configured."));
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)throw new Error(clientTr("Connexion requise.","Sign in required."));
 const {error}=await supabase.from("architect_quality_feedback").insert({
  user_id:user.id,
  site_id:input.siteId,
  proposal_key:input.proposalKey,
  verdict:input.verdict,
  reason:input.verdict==="negative"?(input.reason||"other"):null,
  attempt_kind:input.attemptKind,
  audit_score:Math.max(0,Math.min(100,Math.round(input.auditScore||0))),
  refinement_applied:input.refinementApplied
 });
 if(error){
  if(error.code==="23505")return;
  throw new Error(clientTr("Impossible d’enregistrer cette évaluation pour le moment.","Unable to save this rating right now."));
 }
}
