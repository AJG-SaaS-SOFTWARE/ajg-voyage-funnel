import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const copy: Record<string,{subject:string;body:string}> = {
 payment_failed:{subject:"Action requise sur votre abonnement AJG Builder",body:"Nous n’avons pas pu confirmer votre dernier règlement. Votre site reste modifiable et publié pendant la période de grâce, mais l’assistant IA est temporairement suspendu."},
 reminder_j3:{subject:"Rappel — règlement AJG Builder",body:"Votre règlement reste à régulariser. Votre site continue de fonctionner pendant la période de grâce."},
 reminder_j7:{subject:"Rappel — accès AJG Builder",body:"Votre règlement n’est pas encore régularisé. Pensez à mettre à jour votre moyen de paiement avant la fin de la période de grâce."},
 reminder_j12:{subject:"AJG Builder — restriction prochaine",body:"Sans régularisation, l’édition, les nouvelles publications, les imports et la collecte de nouveaux formulaires seront prochainement suspendus. Votre site public restera encore accessible pendant la période prévue."},
 retention_j74:{subject:"AJG Builder — vos données sont toujours conservées",body:"Votre site est suspendu, mais vos données sont toujours conservées et exportables. Vous pouvez encore régulariser votre abonnement ou récupérer vos données."},
 retention_j97:{subject:"AJG Builder — fin prochaine de la période de conservation",body:"La période de conservation arrive à son terme. Exportez vos données ou régularisez votre abonnement avant la date indiquée dans votre espace de facturation."},
 reactivated:{subject:"Votre site AJG Builder est réactivé",body:"Votre règlement a été confirmé. Les capacités de votre site et son accès public ont été rétablis."}
};

export async function POST(request: Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY, resend=process.env.RESEND_API_KEY, from=process.env.RESEND_FROM_EMAIL;
 if(!url||!serviceKey||!resend||!from) return NextResponse.json({error:"Notification service not configured"},{status:503});
 const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:jobs,error}=await supabase.rpc("claim_due_billing_notifications",{p_limit:20});
 if(error) return NextResponse.json({error:"Queue unavailable"},{status:503});
 let sent=0,failed=0;
 for(const job of jobs||[]){
  try{
   const {data:userData,error:userError}=await supabase.auth.admin.getUserById(job.owner_id);
   if(userError||!userData.user?.email) throw new Error("owner_email_unavailable");
   const message=copy[job.notification_key]; if(!message) throw new Error("unknown_notification");
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${resend}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[userData.user.email],subject:message.subject,text:`${message.body}\n\nAccéder à votre espace : /billing\n\nAJG Builder`})});
   if(!response.ok) throw new Error(`resend_${response.status}`);
   await supabase.rpc("finish_billing_notification",{p_id:job.id,p_success:true,p_error:null}); sent++;
  }catch(error){
   await supabase.rpc("finish_billing_notification",{p_id:job.id,p_success:false,p_error:error instanceof Error?error.message:"unknown"}); failed++;
  }
 }
 return NextResponse.json({claimed:(jobs||[]).length,sent,failed});
}
