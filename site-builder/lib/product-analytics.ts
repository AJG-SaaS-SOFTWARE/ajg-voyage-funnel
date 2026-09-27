import { getSupabaseBrowserClient } from "./supabase-browser";

export type ProductEventName="builder_open"|"step_identity"|"step_story"|"step_booking"|"step_review"|"architect_applied"|"revision_applied"|"publish_success";
export type FeedbackCategory="bug"|"idea"|"usability"|"quality"|"other";

export async function trackProductEvent(eventName:ProductEventName,siteId?:string|null){
 const supabase=getSupabaseBrowserClient();if(!supabase)return;
 const {data:{user}}=await supabase.auth.getUser();if(!user)return;
 const {error}=await supabase.from("product_events").insert({user_id:user.id,site_id:siteId||null,event_name:eventName});
 if(error) console.warn("AJG product event unavailable",error.message);
}

export async function submitFeedback(input:{category:FeedbackCategory;rating?:number;message:string;siteId?:string|null}){
 const supabase=getSupabaseBrowserClient();if(!supabase)throw new Error("Supabase n'est pas configuré.");
 const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Connexion requise.");
 const message=input.message.trim();if(message.length<3)throw new Error("Ajoutez quelques mots pour nous aider à comprendre.");
 const {error}=await supabase.from("user_feedback").insert({user_id:user.id,site_id:input.siteId||null,category:input.category,rating:input.rating||null,message:message.slice(0,2000),status:"new"});
 if(error)throw error;
}
