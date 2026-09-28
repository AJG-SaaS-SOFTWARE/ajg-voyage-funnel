import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime="nodejs";

function validSignature(raw:string,signature:string|null,secret:string){
 if(!signature) return false;
 const expected=createHmac("sha256",secret).update(raw).digest("hex");
 const a=Buffer.from(expected),b=Buffer.from(signature);
 return a.length===b.length&&timingSafeEqual(a,b);
}

export async function POST(request:Request){
 const secret=process.env.BILLING_PROVIDER_WEBHOOK_SECRET;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||!url||!serviceKey) return NextResponse.json({error:"Billing provider adapter not configured"},{status:503});
 const raw=await request.text();
 if(!validSignature(raw,request.headers.get("x-ajg-billing-signature"),secret)) return NextResponse.json({error:"Invalid signature"},{status:400});
 let body:any; try{body=JSON.parse(raw)}catch{return NextResponse.json({error:"Invalid payload"},{status:400})}
 const allowed=new Set(["payment_failed","subscription_past_due","payment_succeeded","subscription_active"]);
 if(typeof body.eventId!=="string"||!allowed.has(body.type)||typeof body.siteId!=="string"||typeof body.ownerId!=="string"||typeof body.status!=="string") return NextResponse.json({error:"Invalid payload"},{status:400});
 const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await supabase.rpc("apply_builder_site_billing_provider_event",{
  p_provider:typeof body.provider==="string"?body.provider:"adapter",
  p_event_id:body.eventId,p_event_type:body.type,p_site_id:body.siteId,p_owner_id:body.ownerId,p_provider_status:body.status,
  p_paid_through:body.paidThrough||null,p_failed_at:body.failedAt||null,p_provider_subscription_id:body.subscriptionId||null
 });
 if(error) return NextResponse.json({error:"Billing event rejected"},{status:400});
 return NextResponse.json({received:true,result:data});
}
