"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { accentColors, backgrounds, patterns, type MediaChoice, type SiteDesign } from "../lib/site-design";

type SearchResult = MediaChoice & { thumbnail: string };

const patternLabels: Record<SiteDesign["pattern"], string> = {
  none: "Uni",
  dots: "Points",
  lines: "Lignes",
  grid: "Quadrillage",
  rays: "Rayons"
};

const backgroundLabels: Record<SiteDesign["background"], string> = {
  ivory: "Ivoire", sand: "Sable", mist: "Brume", sage: "Sauge", slate: "Ardoise"
};

const suggestions = {
  image: [
    { label: "Nature", query: "landscape nature" },
    { label: "Mer", query: "sea beach" },
    { label: "Montagne", query: "mountain landscape" },
    { label: "Ville", query: "city architecture" },
    { label: "Gastronomie", query: "food cooking" }
  ],
  audio: [
    { label: "Nature", query: "forest birds" },
    { label: "Mer", query: "sea waves" },
    { label: "Ambiance", query: "ambient" },
    { label: "Piano", query: "piano" },
    { label: "Ville", query: "city ambience" }
  ]
};

export default function MediaLibrary({ design, onChange }: { design: SiteDesign; onChange: (design: SiteDesign) => void }) {
  const [type, setType] = useState<"image" | "audio">("image");
  const [query, setQuery] = useState("voyage");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const activeSearch = useRef<{ term: string; mediaType: "image" | "audio" } | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const switchType = (next: "image" | "audio") => {
    request.current?.abort();
    setLoading(false);
    setType(next);
    setResults([]);
    setNextPage(null);
    activeSearch.current = null;
    setError("");
    setSearched(false);
    setQuery(next === "image" ? "voyage" : "nature");
  };

  const searchFor = async (term: string, mediaType: "image" | "audio", page = 1) => {
    if (!term.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    if (page === 1) {
      setResults([]);
      setNextPage(null);
      activeSearch.current = { term: term.trim(), mediaType };
    }
    setSearched(true);
    try {
      const params = new URLSearchParams({ type: mediaType, q: term.trim(), page: String(page) });
      const response = await fetch(`/api/media/search?${params}`, { signal: controller.signal });
      const data = await response.json() as { results?: SearchResult[]; hasMore?: boolean; error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || "Recherche indisponible.");
      setResults((previous) => page === 1 ? (data.results || []) : [...previous, ...(data.results || []).filter((item) => !previous.some((existing) => existing.url === item.url))]);
      setNextPage(data.hasMore ? page + 1 : null);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Recherche indisponible.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const search = (event: FormEvent) => {
    event.preventDefault();
    void searchFor(query, type);
  };

  const choose = (item: MediaChoice) => {
    const choice = { url: item.url, title: item.title, creator: item.creator, sourceUrl: item.sourceUrl, licenseUrl: item.licenseUrl };
    onChange({ ...design, [type === "image" ? "heroImage" : "audio"]: choice });
  };

  return (
    <div className="media-library">
      <div className="section-kicker">
        <span>01</span>
        <div><b>Couleur et fond</b><p>Composez l'ambiance de votre site et de sa rubrique de présentation.</p></div>
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
        <div className="custom-color-row">
          <label>Couleur personnalisée
            <input type="color" value={design.accent} onChange={(event) => onChange({ ...design, accent: event.target.value })} />
          </label>
          <label>Code HEX
            <input type="text" value={design.accent} maxLength={7} spellCheck={false} onChange={(event) => {
              const value = event.target.value;
              if (/^#[0-9a-fA-F]{6}$/.test(value)) onChange({ ...design, accent: value });
            }} />
          </label>
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>Fond des rubriques</legend>
        <div className="background-choices">
          {backgrounds.map((background) => <label key={background} className="background-choice" data-background={background}>
            <input type="radio" name="site-background" checked={!design.customBackgroundColor && design.background === background} onChange={() => onChange({ ...design, background, customBackgroundColor: "" })} />
            <span>{backgroundLabels[background]}</span>
          </label>)}
        </div>
        <div className="custom-color-row">
          <label>Fond personnalisé
            <input type="color" value={design.customBackgroundColor || "#f8f4eb"} onChange={(event) => onChange({ ...design, customBackgroundColor: event.target.value })} />
          </label>
          <button type="button" className="secondary" onClick={() => onChange({ ...design, customBackgroundColor: "" })}>Utiliser le fond prédéfini</button>
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>Motif de la présentation</legend>
        <div className="pattern-choices">
          {patterns.map((pattern) => (
            <label key={pattern} className="pattern-choice" data-pattern={pattern}>
              <input type="radio" name="site-pattern" checked={design.pattern === pattern} onChange={() => onChange({ ...design, pattern })} />
              <span>{patternLabels[pattern]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {design.pattern !== "none" ? <>
      <fieldset className="design-fieldset">
        <legend>Couleur du motif</legend>
        <p className="field-help">Automatique utilise la couleur d’accent du site. Vous pouvez aussi choisir une teinte indépendante.</p>
        <div className="custom-color-row">
          <button type="button" className={!design.patternColor ? "secondary active" : "secondary"} aria-pressed={!design.patternColor} onClick={() => onChange({ ...design, patternColor: "" })}>Automatique</button>
          <label>Couleur personnalisée
            <input type="color" value={design.patternColor || design.accent} onChange={(event) => onChange({ ...design, patternColor: event.target.value })} />
          </label>
          <label>Code HEX
            <input type="text" value={design.patternColor || design.accent} maxLength={7} spellCheck={false} onChange={(event) => {
              const value = event.target.value;
              if (/^#[0-9a-fA-F]{6}$/.test(value)) onChange({ ...design, patternColor: value });
            }} />
          </label>
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>Intensité du motif</legend>
        <div className="media-type-tabs">
          <label className="strength-choice"><input type="radio" name="pattern-strength" checked={design.patternStrength === "soft"} onChange={() => onChange({ ...design, patternStrength: "soft" })} /> Discret</label>
          <label className="strength-choice"><input type="radio" name="pattern-strength" checked={design.patternStrength === "bold"} onChange={() => onChange({ ...design, patternStrength: "bold" })} /> Marqué</label>
        </div>
      </fieldset></> : null}

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
      <div className="media-suggestions" aria-label="Idées de recherche">
        <span>Explorer :</span>
        {suggestions[type].map((suggestion) => <button type="button" key={suggestion.label} onClick={() => { setQuery(suggestion.query); void searchFor(suggestion.query, type); }}>{suggestion.label}</button>)}
      </div>
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
              <button type="button" className="secondary" aria-pressed={(type === "image" ? design.heroImage : design.audio)?.url === item.url} onClick={() => choose(item)}>
                {(type === "image" ? design.heroImage : design.audio)?.url === item.url ? "✓ Sélectionné" : "Choisir"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {nextPage && activeSearch.current ? <button type="button" className="media-more" disabled={loading} onClick={() => {
        const current = activeSearch.current;
        if (current) void searchFor(current.term, current.mediaType, nextPage);
      }}>{loading ? "Chargement…" : "Voir plus de résultats"}</button> : null}
      {(design.heroImage || design.audio) ? (
        <div className="media-selected">
          {design.heroImage ? <div className="media-selected-item"><img src={design.heroImage.url} alt="Aperçu de l'image choisie" /><p><b>Image choisie :</b> {design.heroImage.title} <button type="button" onClick={() => onChange({ ...design, heroImage: null })}>Retirer</button></p></div> : null}
          {design.audio ? <div className="media-selected-item"><audio controls preload="none" src={design.audio.url} aria-label={`Écouter ${design.audio.title}`} /><p><b>Son choisi :</b> {design.audio.title} <button type="button" onClick={() => onChange({ ...design, audio: null })}>Retirer</button></p></div> : null}
        </div>
      ) : null}
    </div>
  );
}
