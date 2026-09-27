"use client";

import type { ContentLibrary, SiteArchitecture, SitePageKind, SitePagePlan } from "../lib/site-config";

const kinds: { value: SitePageKind; label: string }[] = [
  { value: "home", label: "Accueil" }, { value: "about", label: "Présentation" }, { value: "services", label: "Services" },
  { value: "gallery", label: "Galerie" }, { value: "faq", label: "FAQ" }, { value: "contact", label: "Contact" }, { value: "custom", label: "Libre" }
];

export default function ArchitectureEditor({ value, library, onChange }: { value: SiteArchitecture; library: ContentLibrary; onChange: (next: SiteArchitecture) => void }) {
  const pages = value.pages;
  const emit = (nextPages: SitePagePlan[]) => onChange({ mode: nextPages.filter((page) => page.enabled).length > 1 ? "multi" : "single", pages: nextPages });
  const update = (id: string, patch: Partial<SitePagePlan>) => emit(pages.map((page) => page.id === id ? { ...page, ...patch } : page));
  const move = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= pages.length) return; const next = [...pages]; [next[index], next[target]] = [next[target], next[index]]; emit(next); };
  const remove = (page: SitePagePlan) => { if (page.kind === "home") return; emit(pages.filter((item) => item.id !== page.id)); };
  const add = () => emit([...pages, { id: crypto.randomUUID(), slug: `page-${pages.length + 1}`, title: "Nouvelle page", kind: "custom", purpose: "", enabled: true, assetIds: [] }]);
  const assign = (page: SitePagePlan, assetId: string, checked: boolean) => update(page.id, { assetIds: checked ? [...new Set([...page.assetIds, assetId])].slice(0, 12) : page.assetIds.filter((id) => id !== assetId) });
  const usableAssets = library.assets.filter((asset) => asset.publishable && asset.rights !== "unknown");

  return <details className="guided-writing-card architecture-editor-card">
    <summary><span className="guided-writing-icon">☷</span><span><b>Arborescence du site</b><small>Réorganisez les pages proposées par l’IA et choisissez manuellement où utiliser vos contenus.</small></span><span className="guided-writing-badge">{pages.length} page{pages.length > 1 ? "s" : ""}</span></summary>
    <div className="guided-writing-body">
      <p className="guided-writing-intro">L’ordre ci-dessous devient l’ordre de navigation. La page d’accueil ne peut pas être supprimée. Les contenus dont les droits ne sont pas validés restent exclus.</p>
      <div className="architecture-list">
        {pages.map((page, index) => <article className={`architecture-page ${page.enabled ? "" : "is-disabled"}`} key={page.id}>
          <div className="architecture-page-head"><span className="architecture-index">{index + 1}</span><input aria-label="Titre de la page" value={page.title} maxLength={80} onChange={(e) => update(page.id, { title: e.target.value })} /><div className="architecture-move"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Monter la page">↑</button><button type="button" disabled={index === pages.length - 1} onClick={() => move(index, 1)} aria-label="Descendre la page">↓</button></div></div>
          <div className="architecture-grid"><label>Type<select value={page.kind} disabled={page.kind === "home"} onChange={(e) => update(page.id, { kind: e.target.value as SitePageKind })}>{kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label><label>Adresse<input value={page.slug} disabled={page.kind === "home"} onChange={(e) => update(page.id, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="ma-page" /></label></div>
          <label>Rôle de cette page<textarea rows={2} maxLength={240} value={page.purpose} onChange={(e) => update(page.id, { purpose: e.target.value })} /></label>
          {usableAssets.length ? <div className="architecture-assets"><b>Contenus affectés</b>{usableAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={page.assetIds.includes(asset.id)} onChange={(e) => assign(page, asset.id, e.target.checked)} /><span>{asset.name} <small>· {asset.kind}</small></span></label>)}</div> : null}
          <div className="architecture-page-actions"><label><input type="checkbox" checked={page.enabled} disabled={page.kind === "home"} onChange={(e) => update(page.id, { enabled: e.target.checked })} /> Page active</label>{page.kind !== "home" ? <button type="button" onClick={() => remove(page)}>Supprimer</button> : <small>Page système</small>}</div>
        </article>)}
      </div>
      <button type="button" className="button secondary" onClick={add}>+ Ajouter une page</button>
    </div>
  </details>;
}
