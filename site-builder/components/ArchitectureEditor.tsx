"use client";

import type { ContentLibrary, SiteArchitecture, SitePageKind, SitePagePlan } from "../lib/site-config";
import { useUiLanguage } from "./LanguageProvider";

export default function ArchitectureEditor({ value, library, onChange }: { value: SiteArchitecture; library: ContentLibrary; onChange: (next: SiteArchitecture) => void }) {
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const kinds: { value: SitePageKind; label: string }[] = [
    { value: "home", label: en ? "Home" : "Accueil" }, { value: "about", label: en ? "About" : "Présentation" }, { value: "services", label: "Services" },
    { value: "gallery", label: en ? "Gallery" : "Galerie" }, { value: "faq", label: "FAQ" }, { value: "contact", label: "Contact" }, { value: "custom", label: en ? "Custom" : "Libre" }
  ];
  const pages = value.pages;
  const emit = (nextPages: SitePagePlan[]) => onChange({ mode: nextPages.filter((page) => page.enabled).length > 1 ? "multi" : "single", pages: nextPages });
  const update = (id: string, patch: Partial<SitePagePlan>) => emit(pages.map((page) => page.id === id ? { ...page, ...patch } : page));
  const move = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= pages.length || pages[index]?.kind === "home" || pages[target]?.kind === "home") return; const next = [...pages]; [next[index], next[target]] = [next[target], next[index]]; emit(next); };
  const remove = (page: SitePagePlan) => { if (page.kind === "home") return; emit(pages.filter((item) => item.id !== page.id)); };
  const add = () => { if (pages.length >= 6) return; emit([...pages, { id: crypto.randomUUID(), slug: `page-${pages.length + 1}`, title: en ? "New page" : "Nouvelle page", kind: "custom", purpose: "", enabled: true, assetIds: [] }]); };
  const assign = (page: SitePagePlan, assetId: string, checked: boolean) => update(page.id, { assetIds: checked ? [...new Set([...page.assetIds, assetId])].slice(0, 12) : page.assetIds.filter((id) => id !== assetId) });
  const usableAssets = library.assets.filter((asset) => asset.publishable && asset.rights !== "unknown");

  return <details className="guided-writing-card architecture-editor-card">
    <summary><span className="guided-writing-icon">☷</span><span><b>{en ? "Website structure" : "Arborescence du site"}</b><small>{en ? "Reorder AI-proposed pages and manually choose where your content is used." : "Réorganisez les pages proposées par l’IA et choisissez manuellement où utiliser vos contenus."}</small></span><span className="guided-writing-badge">{pages.length} page{pages.length > 1 ? "s" : ""}</span></summary>
    <div className="guided-writing-body">
      <p className="guided-writing-intro">{en ? "The order below becomes the navigation order. The home page cannot be deleted. Content whose rights are not validated remains excluded." : "L’ordre ci-dessous devient l’ordre de navigation. La page d’accueil ne peut pas être supprimée. Les contenus dont les droits ne sont pas validés restent exclus."}</p>
      <div className="architecture-list">
        {pages.map((page, index) => <article className={`architecture-page ${page.enabled ? "" : "is-disabled"}`} key={page.id}>
          <div className="architecture-page-head"><span className="architecture-index">{index + 1}</span><input aria-label={en ? "Page title" : "Titre de la page"} value={page.title} maxLength={80} onChange={(e) => update(page.id, { title: e.target.value })} /><div className="architecture-move"><button type="button" disabled={index === 0 || page.kind === "home" || pages[index - 1]?.kind === "home"} onClick={() => move(index, -1)} aria-label={en ? "Move page up" : "Monter la page"}>↑</button><button type="button" disabled={index === pages.length - 1 || page.kind === "home" || pages[index + 1]?.kind === "home"} onClick={() => move(index, 1)} aria-label={en ? "Move page down" : "Descendre la page"}>↓</button></div></div>
          <div className="architecture-grid"><label>{en ? "Type" : "Type"}<select value={page.kind} disabled={page.kind === "home"} onChange={(e) => update(page.id, { kind: e.target.value as SitePageKind })}>{kinds.filter((kind) => page.kind === "home" || kind.value !== "home").map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label><label>{en ? "Address" : "Adresse"}<input value={page.slug} disabled={page.kind === "home"} onChange={(e) => update(page.id, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder={en ? "my-page" : "ma-page"} /></label></div>
          <label>{en ? "Purpose of this page" : "Rôle de cette page"}<textarea rows={2} maxLength={240} value={page.purpose} onChange={(e) => update(page.id, { purpose: e.target.value })} /></label>
          {usableAssets.length ? <div className="architecture-assets"><b>{en ? "Assigned content" : "Contenus affectés"}</b>{usableAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={page.assetIds.includes(asset.id)} onChange={(e) => assign(page, asset.id, e.target.checked)} /><span>{asset.name} <small>· {asset.kind}</small></span></label>)}</div> : null}
          <div className="architecture-page-actions"><label><input type="checkbox" checked={page.enabled} disabled={page.kind === "home"} onChange={(e) => update(page.id, { enabled: e.target.checked })} /> {en ? "Active page" : "Page active"}</label>{page.kind !== "home" ? <button type="button" onClick={() => remove(page)}>{en ? "Delete" : "Supprimer"}</button> : <small>{en ? "System page" : "Page système"}</small>}</div>
        </article>)}
      </div>
      <button type="button" className="button secondary" onClick={add} disabled={pages.length >= 6}>+ {en ? "Add a page" : "Ajouter une page"}</button>{pages.length >= 6 ? <small>{en ? "Maximum 6 pages to keep navigation clear." : "Maximum 6 pages pour garder une navigation claire."}</small> : null}
    </div>
  </details>;
}
