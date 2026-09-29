"use client";

import type { ContentAsset, ContentLibrary } from "../lib/site-config";
import { useProductLocale } from "../lib/product-i18n";

export default function ContentLibraryEditor({ value, onChange, onUpload }: { value: ContentLibrary; onChange: (next: ContentLibrary) => void; onUpload?: (asset: ContentAsset, file: File) => Promise<string> }) {
  const { tr } = useProductLocale();
  const update = (id: string, patch: Partial<ContentAsset>) => onChange({ assets: value.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) });
  const add = (kind: ContentAsset["kind"]) => onChange({ assets: [...value.assets, { id: crypto.randomUUID(), kind, name: "", url: "", text: "", rights: "unknown", sourceUrl: "", notes: "", publishable: false }] });
  const upload = async (asset: ContentAsset, file?: File) => {
    if (!file || !onUpload) return;
    update(asset.id, { notes: [asset.notes, tr("Téléversement en cours…", "Uploading…")].filter(Boolean).join(" · ") });
    try {
      const url = await onUpload(asset, file);
      update(asset.id, { url, name: asset.name || file.name, notes: asset.notes });
    } catch (error) {
      update(asset.id, { notes: `${asset.notes ? asset.notes + " · " : ""}Erreur : ${error instanceof Error ? error.message : tr("téléversement impossible", "upload failed")}` });
    }
  };
  const remove = (id: string) => onChange({ assets: value.assets.filter((asset) => asset.id !== id) });

  return <details className="guided-writing-card content-library-card">
    <summary><span className="guided-writing-icon">＋</span><span><b>{tr("Mes contenus pour l’IA", "My content for AI")}</b><small>{tr("Textes, photos, images, musique ou documents que l’IA peut prendre en compte.", "Text, photos, images, music or documents that AI can use as context.")}</small></span><span className="guided-writing-badge">{value.assets.length} {tr(value.assets.length > 1 ? "contenus" : "contenu", value.assets.length > 1 ? "items" : "item")}</span></summary>
    <div className="guided-writing-body">
      <p className="guided-writing-intro">AJG distingue vos contenus des contenus générés. Un média dont les droits sont inconnus ne sera jamais marqué publiable automatiquement. Les fichiers importés dans cette bibliothèque sont privés par défaut et servent de sources de travail. Un contenu n’est destiné au site public qu’après validation explicite de ses droits et de son statut publiable.</p>
      <div className="content-library-actions">
        <button type="button" className="button secondary" onClick={() => add("text")}>+ {tr("Texte", "Text")}</button>
        <button type="button" className="button secondary" onClick={() => add("image")}>+ {tr("Image / photo", "Image / photo")}</button>
        <button type="button" className="button secondary" onClick={() => add("audio")}>+ {tr("Musique / audio", "Music / audio")}</button>
        <button type="button" className="button secondary" onClick={() => add("document")}>+ {tr("Document", "Document")}</button>
      </div>
      {value.assets.map((asset) => <section className="content-asset-card" key={asset.id}>
        <div className="content-asset-heading"><b>{asset.kind === "text" ? tr("Texte", "Text") : asset.kind === "image" ? tr("Image / photo", "Image / photo") : asset.kind === "audio" ? tr("Musique / audio", "Music / audio") : tr("Document", "Document")}</b><button type="button" onClick={() => remove(asset.id)}>{tr("Retirer", "Remove")}</button></div>
        <label>{tr("Nom", "Name")}<input value={asset.name} maxLength={160} onChange={(e) => update(asset.id, { name: e.target.value })} placeholder={tr("Ex. Présentation de mon activité", "e.g. About my business")} /></label>
        {asset.kind === "text" ? <label>{tr("Contenu", "Content")}<textarea rows={5} maxLength={12000} value={asset.text} onChange={(e) => update(asset.id, { text: e.target.value })} placeholder={tr("Collez ici votre texte, notes ou informations factuelles.", "Paste your text, notes or factual information here.")} /></label> : <><label>{tr("Importer un fichier", "Upload a file")}<input type="file" accept={asset.kind === "image" ? "image/jpeg,image/png,image/webp,image/avif" : asset.kind === "audio" ? "audio/mpeg,audio/mp4,audio/ogg,audio/wav" : "application/pdf,text/plain"} disabled={!onUpload} onChange={(e) => upload(asset, e.target.files?.[0])} /></label><label>{tr("ou utiliser un lien HTTPS", "or use an HTTPS link")}<input type="url" value={asset.url.startsWith("private://") ? "" : asset.url} onChange={(e) => update(asset.id, { url: e.target.value })} placeholder={asset.url.startsWith("private://") ? tr("Fichier privé importé", "Private file uploaded") : "https://…"} /></label></>}
        <label>{tr("Droits d’utilisation", "Usage rights")}<select value={asset.rights} onChange={(e) => { const rights = e.target.value as ContentAsset["rights"]; update(asset.id, { rights, publishable: rights === "unknown" ? false : asset.publishable }); }}><option value="unknown">{tr("Je ne sais pas / à vérifier", "Unknown / needs checking")}</option><option value="owned">{tr("Je possède ce contenu et les droits nécessaires", "I own this content and the required rights")}</option><option value="licensed">{tr("J’ai une licence permettant cette utilisation", "I have a license allowing this use")}</option><option value="public-domain">{tr("Domaine public / licence compatible vérifiée", "Public domain / verified compatible license")}</option></select></label>
        {asset.rights === "licensed" || asset.rights === "public-domain" ? <label>{tr("Source / licence", "Source / license")}<input type="url" value={asset.sourceUrl} onChange={(e) => update(asset.id, { sourceUrl: e.target.value, publishable: e.target.value.trim() ? asset.publishable : false })} placeholder="https://…" /></label> : null}
        <label>{tr("Notes pour l’IA", "Notes for AI")}<input value={asset.notes} maxLength={1000} onChange={(e) => update(asset.id, { notes: e.target.value })} placeholder={tr("Ex. utiliser cette photo dans le hero, ton à conserver…", "e.g. use this photo in the hero, preserve this tone…")} /></label>
        <label className="content-publishable"><input type="checkbox" checked={asset.publishable} disabled={asset.rights === "unknown" || ((asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim())} onChange={(e) => update(asset.id, { publishable: e.target.checked })} /><span>{tr("Autoriser AJG à utiliser ce contenu sur le site publié", "Allow AJG to use this content on the published website")}</span></label>
        {asset.rights === "unknown" ? <small className="content-rights-warning">{tr("Droits à vérifier : l’IA peut connaître l’existence de ce contenu, mais ne doit pas le publier.", "Rights need checking: AI can know this content exists, but must not publish it.")}</small> : null}
        {(asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim() ? <small className="content-rights-warning">{tr("Ajoutez la source ou la licence vérifiée avant d’autoriser la publication.", "Add a verified source or license before allowing publication.")}</small> : null}
      </section>)}
    </div>
  </details>;
}
