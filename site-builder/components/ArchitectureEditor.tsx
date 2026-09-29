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
  const move = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= pages.length || pages[index]?.kind === "home" || pages[target]?.kind === "home") return; const next = [...pages]; [next[index], next[target]] = [next[target], next[index]]; emit(next); };
  const remove = (page: SitePagePlan) => { if (page.kind === "home") return; emit(pages.filter((item) => item.id !== page.id)); };
  const add = () => { if (pages.length >= 6) return; emit([...pages, { id: crypto.randomUUID(), slug: `page-${pages.length + 1}`, title: "Nouvelle page", kind: "custom", purpose: "", headline: "", intro: "", sections: [], enabled: true, assetIds: [] }]); };
  const assign = (page: SitePagePlan, assetId: string, checked: boolean) => update(page.id, { assetIds: checked ? [...new Set([...page.assetIds, assetId])].slice(0, 12) : page.assetIds.filter((id) => id !== assetId) });
  const updateSection = (page: SitePagePlan, sectionIndex: number, patch: Partial<SitePagePlan["sections"][number]>) =>
    update(page.id, {
      sections: page.sections.map((section, index) =>
        index === sectionIndex ? { ...section, ...patch } : section
      )
    });
  const addSection = (page: SitePagePlan) => {
    if (page.kind === "home" || page.sections.length >= 4) return;
    update(page.id, {
      sections: [...page.sections, { heading: "Nouvelle section", text: "" }]
    });
  };
  const removeSection = (page: SitePagePlan, sectionIndex: number) =>
    update(page.id, {
      sections: page.sections.filter((_, index) => index !== sectionIndex)
    });
  const usableAssets = library.assets.filter((asset) => asset.publishable && asset.rights !== "unknown");

  return <details className="guided-writing-card architecture-editor-card">
    <summary><span className="guided-writing-icon">☷</span><span><b>Arborescence du site</b><small>Réorganisez les pages proposées par l’IA et choisissez manuellement où utiliser vos contenus.</small></span><span className="guided-writing-badge">{pages.length} page{pages.length > 1 ? "s" : ""}</span></summary>
    <div className="guided-writing-body">
      <p className="guided-writing-intro">L’ordre ci-dessous devient l’ordre de navigation. La page d’accueil ne peut pas être supprimée. Les contenus dont les droits ne sont pas validés restent exclus.</p>
      <div className="architecture-list">
        {pages.map((page, index) => <article className={`architecture-page ${page.enabled ? "" : "is-disabled"}`} key={page.id}>
          <div className="architecture-page-head"><span className="architecture-index">{index + 1}</span><input aria-label="Titre de la page" value={page.title} maxLength={80} onChange={(e) => update(page.id, { title: e.target.value })} /><div className="architecture-move"><button type="button" disabled={index === 0 || page.kind === "home" || pages[index - 1]?.kind === "home"} onClick={() => move(index, -1)} aria-label="Monter la page">↑</button><button type="button" disabled={index === pages.length - 1 || page.kind === "home" || pages[index + 1]?.kind === "home"} onClick={() => move(index, 1)} aria-label="Descendre la page">↓</button></div></div>
          <div className="architecture-grid"><label>Type<select value={page.kind} disabled={page.kind === "home"} onChange={(e) => update(page.id, { kind: e.target.value as SitePageKind })}>{kinds.filter((kind) => page.kind === "home" || kind.value !== "home").map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label><label>Adresse<input value={page.slug} disabled={page.kind === "home"} onChange={(e) => update(page.id, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="ma-page" /></label></div>
          <label>Rôle de cette page<textarea rows={2} maxLength={240} value={page.purpose} onChange={(e) => update(page.id, { purpose: e.target.value })} /></label>
          {page.kind !== "home" ? (
            <div className="architecture-editorial">
              <label>Accroche de la page<input maxLength={120} value={page.headline} onChange={(e) => update(page.id, { headline: e.target.value })} placeholder={page.title} /></label>
              <label>Introduction<textarea rows={3} maxLength={600} value={page.intro} onChange={(e) => update(page.id, { intro: e.target.value })} placeholder="Quelques phrases pour introduire cette page sans répéter l’accueil." /></label>
              <div className="architecture-sections">
                <div className="architecture-sections-head"><b>Contenu de la page</b><small>{page.sections.length}/4 sections</small></div>
                {page.sections.map((section, sectionIndex) => (
                  <article className="architecture-section" key={`${page.id}-section-${sectionIndex}`}>
                    <div><span>Section {sectionIndex + 1}</span><button type="button" onClick={() => removeSection(page, sectionIndex)}>Supprimer</button></div>
                    <input aria-label={`Titre section ${sectionIndex + 1}`} maxLength={120} value={section.heading} onChange={(e) => updateSection(page, sectionIndex, { heading: e.target.value })} placeholder="Titre de section" />
                    <textarea aria-label={`Texte section ${sectionIndex + 1}`} rows={4} maxLength={1800} value={section.text} onChange={(e) => updateSection(page, sectionIndex, { text: e.target.value })} placeholder="Contenu de cette section" />
                  </article>
                ))}
                <button type="button" className="button secondary architecture-add-section" onClick={() => addSection(page)} disabled={page.sections.length >= 4}>+ Ajouter une section</button>
              </div>
            </div>
          ) : <small className="architecture-home-copy-note">Les textes de l’accueil se modifient dans les champs principaux du Builder.</small>}
          {usableAssets.length ? <div className="architecture-assets"><b>Contenus affectés</b>{usableAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={page.assetIds.includes(asset.id)} onChange={(e) => assign(page, asset.id, e.target.checked)} /><span>{asset.name} <small>· {asset.kind}</small></span></label>)}</div> : null}
          <div className="architecture-page-actions"><label><input type="checkbox" checked={page.enabled} disabled={page.kind === "home"} onChange={(e) => update(page.id, { enabled: e.target.checked })} /> Page active</label>{page.kind !== "home" ? <button type="button" onClick={() => remove(page)}>Supprimer</button> : <small>Page système</small>}</div>
        </article>)}
      </div>
      <button type="button" className="button secondary" onClick={add} disabled={pages.length >= 6}>+ Ajouter une page</button>{pages.length >= 6 ? <small>Maximum 6 pages pour garder une navigation claire.</small> : null}
    </div>
  </details>;
}
