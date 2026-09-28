"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { adminSetPlan,getAdminFeedback,getAdminMetrics,getAdminSites,isCurrentUserAdmin,type AdminFeedback,type AdminMetrics,type AdminSiteRow } from "../../lib/admin";

export default function AdminPage(){
 const [rows,setRows]=useState<AdminSiteRow[]>([]);const [metrics,setMetrics]=useState<AdminMetrics|null>(null);const [feedback,setFeedback]=useState<AdminFeedback[]>([]);const [state,setState]=useState<"loading"|"denied"|"ready">("loading");const [message,setMessage]=useState("");
 const load=async()=>{if(!await isCurrentUserAdmin()){setState("denied");return;}const [sites,nextMetrics,nextFeedback]=await Promise.all([getAdminSites(),getAdminMetrics(),getAdminFeedback()]);setRows(sites);setMetrics(nextMetrics);setFeedback(nextFeedback);setState("ready");};
 useEffect(()=>{void load().catch(e=>{setMessage(e instanceof Error?e.message:"Erreur.");setState("denied");});},[]);
 const changePlan=async(siteId:string,userId:string,plan:"free"|"pro")=>{setMessage("");try{await adminSetPlan(siteId,userId,plan);await load();setMessage("Offre mise à jour.");}catch(e){setMessage(e instanceof Error?e.message:"Mise à jour impossible.");}};
 return <main className="plans-page"><section className="plans-hero"><p className="eyebrow">AJG Administration</p><h1>Pilotage du parc de sites</h1><p>Vue opérationnelle des sites, offres et domaines. L’accès est contrôlé en base par un rôle administrateur dédié.</p><Link className="button secondary" href="/">← Tableau de bord</Link></section>
 {state==="loading"?<p>Chargement…</p>:null}{state==="denied"?<section className="panel"><h2>Accès restreint</h2><p>Votre compte n’a pas le rôle administrateur. Aucun rôle n’est attribué automatiquement depuis le navigateur.</p></section>:null}
 {state==="ready"&&metrics?<section className="admin-metrics"><article><b>{metrics.publishes30d}</b><span>publications · 30 j</span></article><article><b>{metrics.architectApplies30d}</b><span>applications IA · 30 j</span></article><article><b>{metrics.events30d}</b><span>événements produit · 30 j</span></article><article><b>{metrics.feedbackOpen}</b><span>retours à traiter</span></article></section>:null}
 {state==="ready"?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Site</th><th>État</th><th>Offre</th><th>Domaine personnalisé</th><th>Dernière mise à jour</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.slug}</b><small>{row.ownerId.slice(0,8)}…</small></td><td>{row.status}</td><td><select value={row.planKey} onChange={e=>void changePlan(row.id,row.ownerId,e.target.value as "free"|"pro")}><option value="free">Gratuit</option><option value="pro">Pro</option></select></td><td>{row.customDomain||"—"}{row.domainStatus?<small>{row.domainStatus}</small>:null}</td><td>{new Date(row.updatedAt).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table></div>:null}
 {state==="ready"&&feedback.length?<section className="admin-feedback"><h2>Derniers retours bêta</h2>{feedback.map(item=><article key={item.id}><div><b>{item.category} · {item.rating?item.rating+"/5":"sans note"}</b><small>{new Date(item.createdAt).toLocaleDateString("fr-FR")} · {item.status}</small></div><p>{item.message}</p></article>)}</section>:null}
 {message?<p className="plans-note" role="status">{message}</p>:null}</main>;
}