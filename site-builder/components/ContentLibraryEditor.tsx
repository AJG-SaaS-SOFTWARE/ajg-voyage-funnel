"use client";

import type { ContentAsset, ContentLibrary } from "../lib/site-config";
import { useUiLanguage } from "./LanguageProvider";

export default function ContentLibraryEditor({ value, onChange, onUpload }: { value: ContentLibrary; onChange: (next: ContentLibrary) => void; onUpload?: (asset: ContentAsset, file: File) => Promise<string> }) {
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const update = (id: string, patch: Partial<ContentAsset>) => onChange({ assets: value.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) });
  const add = (kind: ContentAsset["kind"]) => onChange({ assets: [...value.assets, { id: crypto.randomUUID(), kind, name: "", url: "", text: "", rights: "unknown", sourceUrl: "", notes: "", publishable: false }] });

  const upload = async (asset: ContentAsset, file?: File) => {
    if (!file || !onUpload) return;
    update(asset.id, { notes: [asset.notes, en ? "Upload in progress…" : "Téléversement en cours…"].filter(Boolean).join(" · ") });
    try {
      const url = await onUpload(asset, file);
      update(asset.id, { url, name: asset.name || file.name, notes: asset.notes });
    } catch (error) {
      update(asset.id, {
        notes: `${asset.notes ? asset.notes + " · " : ""}${en ? "Error" : "Erreur"}: ${error instanceof Error ? error.message : (en ? "upload failed" : "téléversement impossible")}`
      });
    }
  };

  const remove = (id: string) => onChange({ assets: value.assets.filter((asset) => asset.id !== id) });
  const kindLabel = (kind: ContentAsset["kind"]) =>
    kind === "text" ? (en ? "Text" : "Texte")
      : kind === "image" ? (en ? "Image / photo" : "Image / photo")
        : kind === "audio" ? (en ? "Music / audio" : "Musique / audio")
          : (en ? "Document" : "Document");

  return <details className="guided-writing-card content-library-card">
    <summary>
      <span className="guided-writing-icon">＋</span>
      <span>
        <b>{en ? "My content for AI" : "Mes contenus pour l’IA"}</b>
        <small>{en ? "Copy, photos, images, music or documents that AI may take into account." : "Textes, photos, images, musique ou documents que l’IA peut prendre en compte."}</small>
      </span>
      <span className="guided-writing-badge">{value.assets.length} {en ? `item${value.assets.length === 1 ? "" : "s"}` : `contenu${value.assets.length > 1 ? "s" : ""}`}</span>
    </summary>

    <div className="guided-writing-body">
      <p className="guided-writing-intro">
        {en
          ? "AJG keeps your source material separate from generated content. Media with unknown rights is never marked publishable automatically. Files imported here are private by default and are used as working sources. Content is intended for the public website only after its rights and publishable status are explicitly confirmed."
          : "AJG distingue vos contenus des contenus générés. Un média dont les droits sont inconnus ne sera jamais marqué publiable automatiquement. Les fichiers importés dans cette bibliothèque sont privés par défaut et servent de sources de travail. Un contenu n’est destiné au site public qu’après validation explicite de ses droits et de son statut publiable."}
      </p>

      <div className="content-library-actions">
        <button type="button" className="button secondary" onClick={() => add("text")}>+ {en ? "Text" : "Texte"}</button>
        <button type="button" className="button secondary" onClick={() => add("image")}>+ {en ? "Image / photo" : "Image / photo"}</button>
        <button type="button" className="button secondary" onClick={() => add("audio")}>+ {en ? "Music / audio" : "Musique / audio"}</button>
        <button type="button" className="button secondary" onClick={() => add("document")}>+ {en ? "Document" : "Document"}</button>
      </div>

      {value.assets.map((asset) => <section className="content-asset-card" key={asset.id}>
        <div className="content-asset-heading">
          <b>{kindLabel(asset.kind)}</b>
          <button type="button" onClick={() => remove(asset.id)}>{en ? "Remove" : "Retirer"}</button>
        </div>

        <label>
          {en ? "Name" : "Nom"}
          <input value={asset.name} maxLength={160} onChange={(e) => update(asset.id, { name: e.target.value })} placeholder={en ? "E.g. Presentation of my activity" : "Ex. Présentation de mon activité"} />
        </label>

        {asset.kind === "text" ? (
          <label>
            {en ? "Content" : "Contenu"}
            <textarea rows={5} maxLength={12000} value={asset.text} onChange={(e) => update(asset.id, { text: e.target.value })} placeholder={en ? "Paste your copy, notes or factual information here." : "Collez ici votre texte, notes ou informations factuelles."} />
          </label>
        ) : <>
          <label>
            {en ? "Upload a file" : "Importer un fichier"}
            <input type="file" accept={asset.kind === "image" ? "image/jpeg,image/png,image/webp,image/avif" : asset.kind === "audio" ? "audio/mpeg,audio/mp4,audio/ogg,audio/wav" : "application/pdf,text/plain"} disabled={!onUpload} onChange={(e) => upload(asset, e.target.files?.[0])} />
          </label>
          <label>
            {en ? "or use an HTTPS link" : "ou utiliser un lien HTTPS"}
            <input type="url" value={asset.url.startsWith("private://") ? "" : asset.url} onChange={(e) => update(asset.id, { url: e.target.value })} placeholder={asset.url.startsWith("private://") ? (en ? "Private file uploaded" : "Fichier privé importé") : "https://…"} />
          </label>
        </>}

        <label>
          {en ? "Usage rights" : "Droits d’utilisation"}
          <select value={asset.rights} onChange={(e) => {
            const rights = e.target.value as ContentAsset["rights"];
            update(asset.id, { rights, publishable: rights === "unknown" ? false : asset.publishable });
          }}>
            <option value="unknown">{en ? "I do not know / needs checking" : "Je ne sais pas / à vérifier"}</option>
            <option value="owned">{en ? "I own this content and the required rights" : "Je possède ce contenu et les droits nécessaires"}</option>
            <option value="licensed">{en ? "I have a license allowing this use" : "J’ai une licence permettant cette utilisation"}</option>
            <option value="public-domain">{en ? "Public domain / verified compatible license" : "Domaine public / licence compatible vérifiée"}</option>
          </select>
        </label>

        {asset.rights === "licensed" || asset.rights === "public-domain" ? (
          <label>
            {en ? "Source / license" : "Source / licence"}
            <input type="url" value={asset.sourceUrl} onChange={(e) => update(asset.id, { sourceUrl: e.target.value, publishable: e.target.value.trim() ? asset.publishable : false })} placeholder="https://…" />
          </label>
        ) : null}

        <label>
          {en ? "Notes for AI" : "Notes pour l’IA"}
          <input value={asset.notes} maxLength={1000} onChange={(e) => update(asset.id, { notes: e.target.value })} placeholder={en ? "E.g. use this photo in the hero, preserve this tone…" : "Ex. utiliser cette photo dans le hero, ton à conserver…"} />
        </label>

        <label className="content-publishable">
          <input type="checkbox" checked={asset.publishable} disabled={asset.rights === "unknown" || ((asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim())} onChange={(e) => update(asset.id, { publishable: e.target.checked })} />
          <span>{en ? "Allow AJG to use this content on the published website" : "Autoriser AJG à utiliser ce contenu sur le site publié"}</span>
        </label>

        {asset.rights === "unknown" ? <small className="content-rights-warning">{en ? "Rights need checking: AI may know this content exists, but must not publish it." : "Droits à vérifier : l’IA peut connaître l’existence de ce contenu, mais ne doit pas le publier."}</small> : null}
        {(asset.rights === "licensed" || asset.rights === "public-domain") && !asset.sourceUrl.trim() ? <small className="content-rights-warning">{en ? "Add the verified source or license before allowing publication." : "Ajoutez la source ou la licence vérifiée avant d’autoriser la publication."}</small> : null}
      </section>)}
    </div>
  </details>;
}
