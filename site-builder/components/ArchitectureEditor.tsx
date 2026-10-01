"use client";

import type { ContentLibrary, SiteArchitecture, SitePageKind, SitePagePlan } from "../lib/site-config";
import { useProductLocale } from "../lib/product-i18n";

export default function ArchitectureEditor({ value, library, onChange }: { value: SiteArchitecture; library: ContentLibrary; onChange: (next: SiteArchitecture) => void }) {
  const { tr } = useProductLocale();
  const kinds: { value: SitePageKind; label: string }[] = [
    { value: "home", label: tr("Accueil", "Home") }, { value: "about", label: tr("Présentation", "About") }, { value: "services", label: "Services" },
    { value: "gallery", label: tr("Galerie", "Gallery") }, { value: "faq", label: "FAQ" }, { value: "contact", label: "Contact" }, { value: "custom", label: tr("Libre", "Custom") }
  ];
  const pages = value.pages;
  const emit = (nextPages: SitePagePlan[]) => onChange({ mode: nextPages.filter((page) => page.enabled).length > 1 ? "multi" : "single", pages: nextPages });
  const update = (id: string, patch: Partial<SitePagePlan>) => emit(pages.map((page) => page.id === id ? { ...page, ...patch } : page));
  const move = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= pages.length || pages[index]?.kind === "home" || pages[target]?.kind === "home") return; const next = [...pages]; [next[index], next[target]] = [next[target], next[index]]; emit(next); };
  const remove = (page: SitePagePlan) => { if (page.kind === "home") return; emit(pages.filter((item) => item.id !== page.id)); };
  const add = () => { if (pages.length >= 6) return; emit([...pages, { id: crypto.randomUUID(), slug: `page-${pages.length + 1}`, title: tr("Nouvelle page", "New page"), kind: "custom", purpose: "", enabled: true, assetIds: [] }]); };
  const assign = (page: SitePagePlan, assetId: string, checked: boolean) => update(page.id, { assetIds: checked ? [...new Set([...page.assetIds, assetId])].slice(0, 12) : page.assetIds.filter((id) => id !== assetId) });
  const usableAssets = library.assets.filter((asset) => asset.publishable && asset.rights !== "unknown");

  return <details className="guided-writing-card architecture-editor-card">
    <summary><span className="guided-writing-icon">☷</span><span><b>{tr("Arborescence du site", "Website structure")}</b><small>{tr("Ici vous organisez les pages et la navigation. L’ordre des rubriques à l’intérieur de l’accueil se règle ensuite dans Options.", "Organize pages and navigation here. The order of sections inside the homepage is managed later in Options.")}</small></span><span className="guided-writing-badge">{pages.length} {tr(pages.length > 1 ? "pages" : "page", pages.length > 1 ? "pages" : "page")}</span></summary>
    <div className="guided-writing-body">
      <p className="guided-writing-intro">{tr("L’ordre ci-dessous devient l’ordre de navigation. La page d’accueil ne peut pas être supprimée. Les contenus dont les droits ne sont pas validés restent exclus.", "The order below becomes the navigation order. The home page cannot be deleted. Content without validated rights stays excluded.")}</p>
      <div className="architecture-list">
        {pages.map((page, index) => <article className={`architecture-page ${page.enabled ? "" : "is-disabled"}`} key={page.id}>
          <div className="architecture-page-head"><span className="architecture-index">{index + 1}</span><input aria-label={tr("Titre de la page", "Page title")} value={page.title} maxLength={80} onChange={(e) => update(page.id, { title: e.target.value })} /><div className="architecture-move"><button type="button" disabled={index === 0 || page.kind === "home" || pages[index - 1]?.kind === "home"} onClick={() => move(index, -1)} aria-label={tr("Monter la page", "Move page up")}>↑</button><button type="button" disabled={index === pages.length - 1 || page.kind === "home" || pages[index + 1]?.kind === "home"} onClick={() => move(index, 1)} aria-label={tr("Descendre la page", "Move page down")}>↓</button></div></div>
          <div className="architecture-grid"><label>{tr("Type", "Type")}<select value={page.kind} disabled={page.kind === "home"} onChange={(e) => update(page.id, { kind: e.target.value as SitePageKind })}>{kinds.filter((kind) => page.kind === "home" || kind.value !== "home").map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label><label>{tr("Adresse", "Address")}<input value={page.slug} disabled={page.kind === "home"} onChange={(e) => update(page.id, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="ma-page" /></label></div>
          <label>{tr("Rôle de cette page", "Purpose of this page")}<textarea rows={2} maxLength={240} value={page.purpose} onChange={(e) => update(page.id, { purpose: e.target.value })} /></label>
          {usableAssets.length ? <div className="architecture-assets"><b>{tr("Contenus affectés", "Assigned content")}</b>{usableAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={page.assetIds.includes(asset.id)} onChange={(e) => assign(page, asset.id, e.target.checked)} /><span>{asset.name} <small>· {asset.kind}</small></span></label>)}</div> : null}
          <div className="architecture-page-actions"><label><input type="checkbox" checked={page.enabled} disabled={page.kind === "home"} onChange={(e) => update(page.id, { enabled: e.target.checked })} /> {tr("Page active", "Active page")}</label>{page.kind !== "home" ? <button type="button" onClick={() => remove(page)}>{tr("Supprimer", "Delete")}</button> : <small>{tr("Page système", "System page")}</small>}</div>
        </article>)}
      </div>
      <button type="button" className="button secondary" onClick={add} disabled={pages.length >= 6}>+ {tr("Ajouter une page", "Add page")}</button>{pages.length >= 6 ? <small>{tr("Maximum 6 pages pour garder une navigation claire.", "Maximum 6 pages to keep navigation clear.")}</small> : null}
    </div>
  </details>;
}
