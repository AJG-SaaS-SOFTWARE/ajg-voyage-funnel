"use client";

import Link from "next/link";
import { FormEvent,useState } from "react";
import { submitFeedback,type FeedbackCategory } from "../../lib/product-analytics";
import { LanguageSwitch, useUiLanguage } from "../../components/LanguageProvider";

export default function FeedbackPage(){
 const { locale }=useUiLanguage();
 const en=locale==="en";
 const [category,setCategory]=useState<FeedbackCategory>("usability");
 const [rating,setRating]=useState(5);
 const [message,setMessage]=useState("");
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const send=async(e:FormEvent)=>{
  e.preventDefault();
  setBusy(true);
  setStatus("");
  try{
   await submitFeedback({category,rating,message});
   setMessage("");
   setStatus(en?"Thank you. Your feedback has been saved for the next Builder improvement cycle.":"Merci. Votre retour est enregistré pour la prochaine amélioration du Builder.");
  }catch(err){
   setStatus(err instanceof Error?err.message:(en?"Could not send feedback.":"Envoi impossible."));
  }finally{setBusy(false);}
 };
 return <main className="plans-page">
  <section className="plans-hero">
   <div className="builder-heading-row"><p className="eyebrow">AJG Beta</p><LanguageSwitch compact /></div>
   <h1>{en?"Your feedback improves the Builder":"Votre retour améliore le Builder"}</h1>
   <p>{en?"Describe what blocks you, what is missing or what could be simpler. No browsing history, advertising data or website content is automatically added to your message.":"Décrivez ce qui vous bloque, ce qui manque ou ce qui pourrait être plus simple. Aucun historique de navigation, donnée publicitaire ou contenu du site n’est ajouté automatiquement à votre message."}</p>
   <Link className="button secondary" href="/builder">← {en?"Back to Builder":"Retour au builder"}</Link>
  </section>
  <form className="feedback-form" onSubmit={send}>
   <label>{en?"Feedback type":"Type de retour"}
    <select value={category} onChange={e=>setCategory(e.target.value as FeedbackCategory)}>
     <option value="usability">{en?"Ease of use":"Facilité d’utilisation"}</option>
     <option value="quality">{en?"Result quality":"Qualité du résultat"}</option>
     <option value="bug">Bug</option>
     <option value="idea">{en?"Idea":"Idée"}</option>
     <option value="other">{en?"Other":"Autre"}</option>
    </select>
   </label>
   <label>{en?"Overall rating":"Note globale"}
    <select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n}/5</option>)}</select>
   </label>
   <label className="feedback-message">{en?"Your feedback":"Votre retour"}
    <textarea rows={7} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} placeholder={en?"Explain what you were trying to do and what would help you…":"Expliquez ce que vous essayiez de faire et ce qui vous aiderait…"}/>
   </label>
   <button className="button primary" disabled={busy||message.trim().length<3}>{busy?(en?"Sending…":"Envoi…"):(en?"Send feedback":"Envoyer mon retour")}</button>
  </form>
  {status?<p className="plans-note" role="status">{status}</p>:null}
 </main>;
}
