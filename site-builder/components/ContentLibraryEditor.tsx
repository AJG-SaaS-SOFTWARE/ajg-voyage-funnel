"use client";

import type { ContentAsset, ContentLibrary } from "../lib/site-config";

export default function ContentLibraryEditor({ value, onChange, onUpload }: { value: ContentLibrary; onChange: (next: ContentLibrary) => void; onUpload?: (asset: ContentAsset, file: File) => Promise<string> }) {
  const update = (id: string, patch: Partial<ContentAsset>) => onChange({ assets: value.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) });
  const add = (kind: ContentAsset["kind"]) => onChange({ assets: [...value.assets, { id: crypto.randomUUID(), kind, name: "", url: "", text: "", rights: "unknown", sourceUrl: "", notes: "", publishable: false }] });
  const upload = async (asset: ContentAsset, file?: File) => {
    if (!file || !onUpload) return;
    update(asset.id, { notes: [asset.notes, "Téléversement en cours…"].filter(Boolean).join(" · ") });
    try {
      const url = await onUpload(asset, file);
      update(asset.id, { url, name: asset.name || file.name, notes: asset.notes });
    } catch (error) {
      update(asset.id, { notes: `${asset.notes ? asset.notes + " · " : ""}Erreur : ${error instanceof Error ? error.message : "téléversement impossible"}` });
    }
  };
  const remove = (id: string) => onChange({ assets: value.assets.filter((asset) => asset.id !== id) });

  return <details className="guided-writing-card content-library-card">
    <summary><span className="guided-writing-icon">＋</span><span><b>Mes contenus pour l’IA</b><small>Textes, photos, images, musique ou documents que l’IA peut prendre en compte.</small></span><span className="guided-writing-badge">{value.assets.length} contenu{value.assets.length > 1 ? "s" : ""}</span></summary>
    <div className="guided-writing-body">
      <p className="guided-writing-intro">AJG distingue vos contenus des contenus générés. Un média dont les droits sont inconnus ne sera jamais marqué publiable automatiquement. Les fichiers importés sont stockés sur l’infrastructure média du site : n’importez pas de document confidentiel ou contenant des données personnelles qui ne doivent pas être accessibles depuis le Web.</p>
      <div className="content-library-actions">
        <button type="button" className="button secondary" onClick={() => add("text")}>+ Texte</button>
        <button type="button" className="button secondary" onClick={() => add("image")}>+ Image / photo</button>
        <button type="button" className="button secondary" onClick={() => add("audio")}>+ Musique / audio</button>
        <button type="button" className="button secondary" onClick={() => add("document")}>+ Document</button>
      </div>
      {value.assets.map((asset) => <section className="content-asset-card" key={asset.id}>
        <div className="content-asset-heading"><b>{asset.kind === "text" ? "Texte" : asset.kind === "image" ? "Image / photo" : asset.kind === "audio" ? "Musique / audio" : "Document"}</b><button type="button" onClick={() => remove(asset.id)}>Retirer</button></div>
        <label>Nom<input value={asset.name} maxLength={160} onChange={(e) => update(asset.id, { name: e.target.value })} placeholder="Ex. Présentation de mon activité" /></label>
        {asset.kind === "text" ? <label>Contenu<textarea rows={5} maxLength={12000} value={asset.text} onChange={(e) => update(asset.id, { text: e.target.value })} placeholder="Collez ici votre texte, notes ou informations factuelles." /></label> : <><label>Importer un fichier<input type="file" accept={asset.kind === "image" ? "image/jpeg,image/png,image/webp,image/avif" : asset.kind === "audio" ? "audio/mpeg,audio/mp4,audio/ogg,audio/wav" : "application/pdf,text/plain"} disabled={!onUpload} onChange={(e) => upload(asset, e.target.files?.[0])} /></label><label>ou utiliser un lien HTTPS<input type="url" value={asset.url} onChange={(e) => update(asset.id, { url: e.target.value })} placeholder="https://…" /></label></>}
        <label>Droits d’utilisation<select value={asset.rights} onChange={(e) => { const rights = e.target.value as ContentAsset["rights"]; update(asset.id, { rights, publishable: rights === "unknown" ? false : asset.publishable }); }}><option value="unknown">Je ne sais pas / à vérifier</option><option value="owned">Je possède ce contenu et les droits nécessaires</option><option value="licensed">J’ai une licence permettant cette utilisation</option><option value="public-domain">Domaine public / licence compatible vérifiée</option></select></label>
        {asset.rights === "licensed" || asset.rights === "public-domain" ? <label>Source / licence<input type="url" value={asset.sourceUrl} onChange={(e) => update(asset.id, { sourceUrl: e.target.value, publishable: e.target.value.trim() ? asset.publishable : false })} placeholder="https://…" /></label> : null}
        <label>Notes pour l’IA<input value={asset.notes} maxLength={1000} onChange={(e) => update(asset.id, { notes: e.target.value })} placeholder="Ex. utiliser cette photo dans le hero, ton à conserver…" /></label>
        <label className="content-publishable"><input type="checkbox" checked={asset.publishable} disabled={asset.rights === "unknown" || ((asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim())} onChange={(e) => update(asset.id, { publishable: e.target.checked })} /><span>Autoriser AJG à utiliser ce contenu sur le site publié</span></label>
        {asset.rights === "unknown" ? <small className="content-rights-warning">Droits à vérifier : l’IA peut connaître l’existence de ce contenu, mais ne doit pas le publier.</small> : null}
        {(asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim() ? <small className="content-rights-warning">Ajoutez la source ou la licence vérifiée avant d’autoriser la publication.</small> : null}
      </section>)}
    </div>
  </details>;
}
