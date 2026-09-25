"use client";

import { FormEvent, useState } from "react";
import { accentColors, patterns, type MediaChoice, type SiteDesign } from "../lib/site-design";

type SearchResult = MediaChoice & { thumbnail: string };

const patternLabels: Record<SiteDesign["pattern"], string> = {
  none: "Uni",
  dots: "Points",
  lines: "Lignes",
  grid: "Quadrillage",
  rays: "Rayons"
};

export default function MediaLibrary({ design, onChange }: { design: SiteDesign; onChange: (design: SiteDesign) => void }) {
  const [type, setType] = useState<"image" | "audio">("image");
  const [query, setQuery] = useState("voyage");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const switchType = (next: "image" | "audio") => {
    setType(next);
    setResults([]);
    setError("");
    setSearched(false);
    setQuery(next === "image" ? "voyage" : "nature");
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSearched(true);
    try {
      const params = new URLSearchParams({ type, q: query.trim() });
      const response = await fetch(`/api/media/search?${params}`);
      const data = await response.json() as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Recherche indisponible.");
      setResults(data.results || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recherche indisponible.");
    } finally {
      setLoading(false);
    }
  };

  const choose = (item: MediaChoice) => {
    const choice = { url: item.url, title: item.title, creator: item.creator, sourceUrl: item.sourceUrl, licenseUrl: item.licenseUrl };
    onChange({ ...design, [type === "image" ? "heroImage" : "audio"]: choice });
  };

  return (
    <div className="media-library">
      <div className="section-kicker">
        <span>01</span>
        <div><b>Couleur et motif</b><p>Choisissez une touche visuelle pour l'accueil de votre site.</p></div>
      </div>
      <fieldset className="design-fieldset">
        <legend>Couleur d'accent</legend>
        <div className="accent-choices">
          {accentColors.map((color, index) => (
            <label key={color} className="accent-choice" style={{ backgroundColor: color }} title={`Couleur ${index + 1}`}>
              <input type="radio" name="site-accent" checked={design.accent === color} onChange={() => onChange({ ...design, accent: color })} />
              <span className="sr-only">Couleur {index + 1}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>Motif de fond</legend>
        <div className="pattern-choices">
          {patterns.map((pattern) => (
            <label key={pattern} className="pattern-choice" data-pattern={pattern}>
              <input type="radio" name="site-pattern" checked={design.pattern === pattern} onChange={() => onChange({ ...design, pattern })} />
              <span>{patternLabels[pattern]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="section-kicker">
        <span>02</span>
        <div><b>Images et sons</b><p>Recherchez une ambiance puis choisissez ce qui correspond à votre site.</p></div>
      </div>
      <div className="media-type-tabs" role="group" aria-label="Type de média">
        <button type="button" className={type === "image" ? "active" : ""} aria-pressed={type === "image"} onClick={() => switchType("image")}>Images</button>
        <button type="button" className={type === "audio" ? "active" : ""} aria-pressed={type === "audio"} onClick={() => switchType("audio")}>Sons</button>
      </div>
      <form className="media-search" onSubmit={search}>
        <label htmlFor="media-query">Rechercher {type === "image" ? "une image" : "un son"}</label>
        <div>
          <input id="media-query" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder={type === "image" ? "Ex. montagne, ville, gastronomie…" : "Ex. nature, piano, ambiance…"} />
          <button className="primary" disabled={loading || !query.trim()}>{loading ? "Recherche…" : "Rechercher"}</button>
        </div>
      </form>
      <p className="media-license-note">Résultats déclarés CC0 par leurs sources via Openverse. Ouvrez la fiche source pour vérifier la licence et les éventuels droits liés aux personnes ou marques visibles.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!loading && !error && results.length === 0 ? <p className="media-empty">{searched ? "Aucun résultat pour cette recherche. Essayez un autre terme." : "Lancez une recherche pour explorer la médiathèque."}</p> : null}
      <div className="media-results" aria-live="polite">
        {results.map((item) => (
          <article className="media-result" key={item.sourceUrl + item.url}>
            {type === "image" ? <img src={item.thumbnail} alt={item.title} loading="lazy" /> : <audio controls preload="none" src={item.url} aria-label={`Écouter ${item.title}`} />}
            <div className="media-result-copy">
              <b title={item.title}>{item.title}</b>
              <small>{item.creator} · CC0</small>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Vérifier la source ↗</a>
              <button type="button" className="secondary" onClick={() => choose(item)}>Choisir</button>
            </div>
          </article>
        ))}
      </div>
      {(design.heroImage || design.audio) ? (
        <div className="media-selected">
          {design.heroImage ? <p><b>Image choisie :</b> {design.heroImage.title} <button type="button" onClick={() => onChange({ ...design, heroImage: null })}>Retirer</button></p> : null}
          {design.audio ? <p><b>Son choisi :</b> {design.audio.title} <button type="button" onClick={() => onChange({ ...design, audio: null })}>Retirer</button></p> : null}
        </div>
      ) : null}
    </div>
  );
}
