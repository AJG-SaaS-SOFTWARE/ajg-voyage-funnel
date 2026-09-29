"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { accentColors, backgrounds, patterns, type MediaChoice, type SiteDesign } from "../lib/site-design";
import { useUiLanguage } from "./LanguageProvider";

type SearchResult = MediaChoice & { thumbnail: string };

const patternLabelsFr: Record<SiteDesign["pattern"], string> = {
  none: "Uni",
  dots: "Points",
  lines: "Lignes",
  grid: "Quadrillage",
  rays: "Rayons"
};

const backgroundLabelsFr: Record<SiteDesign["background"], string> = {
  ivory: "Ivoire", sand: "Sable", mist: "Brume", sage: "Sauge", slate: "Ardoise"
};

const suggestionsFr = {
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

const patternLabelsEn: Record<SiteDesign["pattern"], string> = {
  none: "Solid",
  dots: "Dots",
  lines: "Lines",
  grid: "Grid",
  rays: "Rays"
};

const backgroundLabelsEn: Record<SiteDesign["background"], string> = {
  ivory: "Ivory", sand: "Sand", mist: "Mist", sage: "Sage", slate: "Slate"
};

const suggestionsEn = {
  image: [
    { label: "Nature", query: "landscape nature" },
    { label: "Sea", query: "sea beach" },
    { label: "Mountains", query: "mountain landscape" },
    { label: "City", query: "city architecture" },
    { label: "Food", query: "food cooking" }
  ],
  audio: [
    { label: "Nature", query: "forest birds" },
    { label: "Sea", query: "sea waves" },
    { label: "Ambient", query: "ambient" },
    { label: "Piano", query: "piano" },
    { label: "City", query: "city ambience" }
  ]
};

export default function MediaLibrary({ design, onChange }: { design: SiteDesign; onChange: (design: SiteDesign) => void }) {
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const patternLabels = en ? patternLabelsEn : patternLabelsFr;
  const backgroundLabels = en ? backgroundLabelsEn : backgroundLabelsFr;
  const suggestions = en ? suggestionsEn : suggestionsFr;
  const [type, setType] = useState<"image" | "audio">("image");
  const [query, setQuery] = useState(en ? "travel" : "voyage");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [accentHex, setAccentHex] = useState(design.accent);
  const [patternHex, setPatternHex] = useState(design.patternColor || design.accent);

  useEffect(() => setAccentHex(design.accent), [design.accent]);
  useEffect(() => setPatternHex(design.patternColor || design.accent), [design.patternColor, design.accent]);
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
    setQuery(next === "image" ? (en ? "travel" : "voyage") : "nature");
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
      if (!response.ok) throw new Error(data.error || (en ? "Search unavailable." : "Recherche indisponible."));
      setResults((previous) => page === 1 ? (data.results || []) : [...previous, ...(data.results || []).filter((item) => !previous.some((existing) => existing.url === item.url))]);
      setNextPage(data.hasMore ? page + 1 : null);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : (en ? "Search unavailable." : "Recherche indisponible."));
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
        <div><b>{en ? "Color and background" : "Couleur et fond"}</b><p>{en ? "Shape the visual atmosphere of your website and its presentation sections." : "Composez l'ambiance de votre site et de sa rubrique de présentation."}</p></div>
      </div>
      <fieldset className="design-fieldset">
        <legend>{en ? "Accent color" : "Couleur d'accent"}</legend>
        <div className="accent-choices">
          {accentColors.map((color, index) => (
            <label key={color} className="accent-choice" style={{ backgroundColor: color }} title={`${en ? "Color" : "Couleur"} ${index + 1}`}>
              <input type="radio" name="site-accent" checked={design.accent === color} onChange={() => onChange({ ...design, accent: color })} />
              <span className="sr-only">{en ? "Color" : "Couleur"} {index + 1}</span>
            </label>
          ))}
        </div>
        <div className="custom-color-row">
          <label>{en ? "Custom color" : "Couleur personnalisée"}
            <input type="color" value={design.accent} onChange={(event) => onChange({ ...design, accent: event.target.value })} />
          </label>
          <label>Code HEX
            <input type="text" value={accentHex} maxLength={7} spellCheck={false} onChange={(event) => {
              const value = event.target.value;
              setAccentHex(value);
              if (/^#[0-9a-fA-F]{6}$/.test(value)) onChange({ ...design, accent: value });
            }} onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(accentHex)) setAccentHex(design.accent); }} />
          </label>
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>{en ? "Section background" : "Fond des rubriques"}</legend>
        <div className="background-choices">
          {backgrounds.map((background) => <label key={background} className="background-choice" data-background={background}>
            <input type="radio" name="site-background" checked={!design.customBackgroundColor && design.background === background} onChange={() => onChange({ ...design, background, customBackgroundColor: "" })} />
            <span>{backgroundLabels[background]}</span>
          </label>)}
        </div>
        <div className="custom-color-row">
          <label>{en ? "Custom background" : "Fond personnalisé"}
            <input type="color" value={design.customBackgroundColor || "#f8f4eb"} onChange={(event) => onChange({ ...design, customBackgroundColor: event.target.value })} />
          </label>
          <button type="button" className="secondary" onClick={() => onChange({ ...design, customBackgroundColor: "" })}>{en ? "Use preset background" : "Utiliser le fond prédéfini"}</button>
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>{en ? "Presentation pattern" : "Motif de la présentation"}</legend>
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
        <legend>{en ? "Pattern color" : "Couleur du motif"}</legend>
        <p className="field-help">{en ? "Automatic uses the website accent color. You can also choose an independent color." : "Automatique utilise la couleur d’accent du site. Vous pouvez aussi choisir une teinte indépendante."}</p>
        <div className="custom-color-row">
          <button type="button" className={!design.patternColor ? "secondary active" : "secondary"} aria-pressed={!design.patternColor} onClick={() => onChange({ ...design, patternColor: "" })}>{en ? "Automatic" : "Automatique"}</button>
          <label>{en ? "Custom color" : "Couleur personnalisée"}
            <input type="color" value={design.patternColor || design.accent} onChange={(event) => onChange({ ...design, patternColor: event.target.value })} />
          </label>
          <label>Code HEX
            <input type="text" value={patternHex} maxLength={7} spellCheck={false} onChange={(event) => {
              const value = event.target.value;
              setPatternHex(value);
              if (/^#[0-9a-fA-F]{6}$/.test(value)) onChange({ ...design, patternColor: value });
            }} onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(patternHex)) setPatternHex(design.patternColor || design.accent); }} />
          </label>
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>{en ? "Pattern intensity" : "Intensité du motif"}</legend>
        <div className="media-type-tabs">
          <label className="strength-choice"><input type="radio" name="pattern-strength" checked={design.patternStrength === "soft"} onChange={() => onChange({ ...design, patternStrength: "soft" })} /> {en ? "Subtle" : "Discret"}</label>
          <label className="strength-choice"><input type="radio" name="pattern-strength" checked={design.patternStrength === "bold"} onChange={() => onChange({ ...design, patternStrength: "bold" })} /> {en ? "Bold" : "Marqué"}</label>
        </div>
      </fieldset></> : null}

      <div className="section-kicker">
        <span>02</span>
        <div><b>{en ? "Images and audio" : "Images et sons"}</b><p>{en ? "Search for a mood, then choose what fits your website." : "Recherchez une ambiance puis choisissez ce qui correspond à votre site."}</p></div>
      </div>
      <div className="media-type-tabs" role="group" aria-label={en ? "Media type" : "Type de média"}>
        <button type="button" className={type === "image" ? "active" : ""} aria-pressed={type === "image"} onClick={() => switchType("image")}>{en ? "Images" : "Images"}</button>
        <button type="button" className={type === "audio" ? "active" : ""} aria-pressed={type === "audio"} onClick={() => switchType("audio")}>{en ? "Audio" : "Sons"}</button>
      </div>
      <form className="media-search" onSubmit={search}>
        <label htmlFor="media-query">{en ? "Search for" : "Rechercher"} {type === "image" ? (en ? "an image" : "une image") : (en ? "audio" : "un son")}</label>
        <div>
          <input id="media-query" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder={type === "image" ? (en ? "E.g. mountains, city, food…" : "Ex. montagne, ville, gastronomie…") : (en ? "E.g. nature, piano, ambient…" : "Ex. nature, piano, ambiance…")} />
          <button className="primary" disabled={loading || !query.trim()}>{loading ? (en ? "Searching…" : "Recherche…") : (en ? "Search" : "Rechercher")}</button>
        </div>
      </form>
      <div className="media-suggestions" aria-label={en ? "Search ideas" : "Idées de recherche"}>
        <span>{en ? "Explore:" : "Explorer :"}</span>
        {suggestions[type].map((suggestion) => <button type="button" key={suggestion.label} onClick={() => { setQuery(suggestion.query); void searchFor(suggestion.query, type); }}>{suggestion.label}</button>)}
      </div>
      <p className="media-license-note">{en ? "Results are declared CC0 by their sources through Openverse. Open the source page to verify the license and any rights related to visible people or brands." : "Résultats déclarés CC0 par leurs sources via Openverse. Ouvrez la fiche source pour vérifier la licence et les éventuels droits liés aux personnes ou marques visibles."}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!loading && !error && results.length === 0 ? <p className="media-empty">{searched ? (en ? "No results for this search. Try another term." : "Aucun résultat pour cette recherche. Essayez un autre terme.") : (en ? "Start a search to explore the media library." : "Lancez une recherche pour explorer la médiathèque.")}</p> : null}
      <div className="media-results" aria-live="polite">
        {results.map((item) => (
          <article className="media-result" key={item.sourceUrl + item.url}>
            {type === "image" ? <img src={item.thumbnail} alt={item.title} loading="lazy" /> : <audio controls preload="none" src={item.url} aria-label={`${en ? "Listen to" : "Écouter"} ${item.title}`} />}
            <div className="media-result-copy">
              <b title={item.title}>{item.title}</b>
              <small>{item.creator} · CC0</small>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{en ? "Check source ↗" : "Vérifier la source ↗"}</a>
              <button type="button" className="secondary" aria-pressed={(type === "image" ? design.heroImage : design.audio)?.url === item.url} onClick={() => choose(item)}>
                {(type === "image" ? design.heroImage : design.audio)?.url === item.url ? (en ? "✓ Selected" : "✓ Sélectionné") : (en ? "Choose" : "Choisir")}
              </button>
            </div>
          </article>
        ))}
      </div>
      {nextPage && activeSearch.current ? <button type="button" className="media-more" disabled={loading} onClick={() => {
        const current = activeSearch.current;
        if (current) void searchFor(current.term, current.mediaType, nextPage);
      }}>{loading ? (en ? "Loading…" : "Chargement…") : (en ? "Show more results" : "Voir plus de résultats")}</button> : null}
      {(design.heroImage || design.audio) ? (
        <div className="media-selected">
          {design.heroImage ? <div className="media-selected-item"><img src={design.heroImage.url} alt={en ? "Selected image preview" : "Aperçu de l'image choisie"} /><p><b>{en ? "Selected image:" : "Image choisie :"}</b> {design.heroImage.title} <button type="button" onClick={() => onChange({ ...design, heroImage: null })}>{en ? "Remove" : "Retirer"}</button></p></div> : null}
          {design.audio ? <div className="media-selected-item"><audio controls preload="none" src={design.audio.url} aria-label={`Écouter ${design.audio.title}`} /><p><b>{en ? "Selected audio:" : "Son choisi :"}</b> {design.audio.title} <button type="button" onClick={() => onChange({ ...design, audio: null })}>{en ? "Remove" : "Retirer"}</button></p></div> : null}
        </div>
      ) : null}
    </div>
  );
}
