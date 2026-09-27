"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { adminSetPlan,getAdminSites,isCurrentUserAdmin,type AdminSiteRow } from "../../lib/admin";

export default function AdminPage(){
 const [rows,setRows]=useState<AdminSiteRow[]>([]);const [state,setState]=useState<"loading"|"denied"|"ready">("loading");const [message,setMessage]=useState("");
 const load=async()=>{if(!await isCurrentUserAdmin()){setState("denied");return;}setRows(await getAdminSites());setState("ready");};
 useEffect(()=>{void load().catch(e=>{setMessage(e instanceof Error?e.message:"Erreur.");setState("denied");});},[]);
 const changePlan=async(userId:string,plan:"free"|"pro")=>{setMessage("");try{await adminSetPlan(userId,plan);await load();setMessage("Offre mise à jour.");}catch(e){setMessage(e instanceof Error?e.message:"Mise à jour impossible.");}};
 return <main className="plans-page"><section className="plans-hero"><p className="eyebrow">AJG Administration</p><h1>Pilotage du parc de sites</h1><p>Vue opérationnelle des sites, offres et domaines. L’accès est contrôlé en base par un rôle administrateur dédié.</p><Link className="button secondary" href="/">← Tableau de bord</Link></section>
 {state==="loading"?<p>Chargement…</p>:null}{state==="denied"?<section className="panel"><h2>Accès restreint</h2><p>Votre compte n’a pas le rôle administrateur. Aucun rôle n’est attribué automatiquement depuis le navigateur.</p></section>:null}
 {state==="ready"?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Site</th><th>État</th><th>Offre</th><th>Domaine personnalisé</th><th>Dernière mise à jour</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.slug}</b><small>{row.ownerId.slice(0,8)}…</small></td><td>{row.status}</td><td><select value={row.planKey} onChange={e=>void changePlan(row.ownerId,e.target.value as "free"|"pro")}><option value="free">Gratuit</option><option value="pro">Pro</option></select></td><td>{row.customDomain||"—"}{row.domainStatus?<small>{row.domainStatus}</small>:null}</td><td>{new Date(row.updatedAt).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table></div>:null}
 {message?<p className="plans-note" role="status">{message}</p>:null}</main>;
}