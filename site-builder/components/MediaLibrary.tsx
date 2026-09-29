"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { accentColors, backgrounds, patterns, type MediaChoice, type SiteDesign } from "../lib/site-design";
import { useProductLocale } from "../lib/product-i18n";

type SearchResult = MediaChoice & { thumbnail: string };

export default function MediaLibrary({ design, onChange }: { design: SiteDesign; onChange: (design: SiteDesign) => void }) {
  const { tr } = useProductLocale();
  const patternLabels: Record<SiteDesign["pattern"], string> = {
    none: tr("Uni", "Plain"),
    dots: tr("Points", "Dots"),
    lines: tr("Lignes", "Lines"),
    grid: tr("Quadrillage", "Grid"),
    rays: tr("Rayons", "Rays")
  };
  const backgroundLabels: Record<SiteDesign["background"], string> = {
    ivory: tr("Ivoire", "Ivory"),
    sand: tr("Sable", "Sand"),
    mist: tr("Brume", "Mist"),
    sage: tr("Sauge", "Sage"),
    slate: tr("Ardoise", "Slate")
  };
  const suggestions = {
    image: [
      { label: tr("Nature", "Nature"), query: "landscape nature" },
      { label: tr("Mer", "Sea"), query: "sea beach" },
      { label: tr("Montagne", "Mountain"), query: "mountain landscape" },
      { label: tr("Ville", "City"), query: "city architecture" },
      { label: tr("Gastronomie", "Food"), query: "food cooking" }
    ],
    audio: [
      { label: tr("Nature", "Nature"), query: "forest birds" },
      { label: tr("Mer", "Sea"), query: "sea waves" },
      { label: tr("Ambiance", "Ambient"), query: "ambient" },
      { label: tr("Piano", "Piano"), query: "piano" },
      { label: tr("Ville", "City"), query: "city ambience" }
    ]
  };
  const [type, setType] = useState<"image" | "audio">("image");
  const [query, setQuery] = useState("");
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
    setQuery("");
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
      if (!response.ok) throw new Error(data.error || tr("Recherche indisponible.", "Search unavailable."));
      setResults((previous) => page === 1 ? (data.results || []) : [...previous, ...(data.results || []).filter((item) => !previous.some((existing) => existing.url === item.url))]);
      setNextPage(data.hasMore ? page + 1 : null);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : tr("Recherche indisponible.", "Search unavailable."));
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
        <div><b>{tr("Couleur et fond", "Color and background")}</b><p>{tr("Composez l’ambiance de votre site et de sa rubrique de présentation.", "Shape the look and feel of your website and its presentation section.")}</p></div>
      </div>
      <fieldset className="design-fieldset">
        <legend>{tr("Couleur d’accent", "Accent color")}</legend>
        <div className="accent-choices">
          {accentColors.map((color, index) => (
            <label key={color} className="accent-choice" style={{ backgroundColor: color }} title={`${tr("Couleur", "Color")} ${index + 1}`}>
              <input type="radio" name="site-accent" checked={design.accent === color} onChange={() => onChange({ ...design, accent: color })} />
              <span className="sr-only">{tr("Couleur", "Color")} {index + 1}</span>
            </label>
          ))}
        </div>
        <div className="custom-color-row">
          <label>{tr("Couleur personnalisée", "Custom color")}
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
        <legend>{tr("Fond des rubriques", "Section background")}</legend>
        <div className="background-choices">
          {backgrounds.map((background) => <label key={background} className="background-choice" data-background={background}>
            <input type="radio" name="site-background" checked={!design.customBackgroundColor && design.background === background} onChange={() => onChange({ ...design, background, customBackgroundColor: "" })} />
            <span>{backgroundLabels[background]}</span>
          </label>)}
        </div>
        <div className="custom-color-row">
          <label>{tr("Fond personnalisé", "Custom background")}
            <input type="color" value={design.customBackgroundColor || "#f8f4eb"} onChange={(event) => onChange({ ...design, customBackgroundColor: event.target.value })} />
          </label>
          <button type="button" className="secondary" onClick={() => onChange({ ...design, customBackgroundColor: "" })}>{tr("Utiliser le fond prédéfini", "Use preset background")}</button>
        </div>
      </fieldset>
      <fieldset className="design-fieldset">
        <legend>{tr("Motif de la présentation", "Presentation pattern")}</legend>
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
        <legend>{tr("Couleur du motif", "Pattern color")}</legend>
        <p className="field-help">{tr("Automatique utilise la couleur d’accent du site. Vous pouvez aussi choisir une teinte indépendante.", "Automatic uses the website accent color. You can also choose a separate tone.")}</p>
        <div className="custom-color-row">
          <button type="button" className={!design.patternColor ? "secondary active" : "secondary"} aria-pressed={!design.patternColor} onClick={() => onChange({ ...design, patternColor: "" })}>{tr("Automatique", "Automatic")}</button>
          <label>Couleur personnalisée
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
        <legend>{tr("Intensité du motif", "Pattern intensity")}</legend>
        <div className="media-type-tabs">
          <label className="strength-choice"><input type="radio" name="pattern-strength" checked={design.patternStrength === "soft"} onChange={() => onChange({ ...design, patternStrength: "soft" })} /> {tr("Discret", "Subtle")}</label>
          <label className="strength-choice"><input type="radio" name="pattern-strength" checked={design.patternStrength === "bold"} onChange={() => onChange({ ...design, patternStrength: "bold" })} /> {tr("Marqué", "Bold")}</label>
        </div>
      </fieldset></> : null}

      <div className="section-kicker">
        <span>02</span>
        <div><b>{tr("Images et sons", "Images and sound")}</b><p>{tr("Recherchez une ambiance puis choisissez ce qui correspond à votre site.", "Search for a mood and choose what fits your website.")}</p></div>
      </div>
      <div className="media-type-tabs" role="group" aria-label={tr("Type de média", "Media type")}>
        <button type="button" className={type === "image" ? "active" : ""} aria-pressed={type === "image"} onClick={() => switchType("image")}>{tr("Images", "Images")}</button>
        <button type="button" className={type === "audio" ? "active" : ""} aria-pressed={type === "audio"} onClick={() => switchType("audio")}>{tr("Sons", "Sounds")}</button>
      </div>
      <form className="media-search" onSubmit={search}>
        <label htmlFor="media-query">{tr("Rechercher", "Search for")} {type === "image" ? tr("une image", "an image") : tr("un son", "a sound")}</label>
        <div>
          <input id="media-query" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder={type === "image" ? tr("Ex. montagne, ville, gastronomie…", "e.g. mountain, city, food…") : tr("Ex. nature, piano, ambiance…", "e.g. nature, piano, ambience…")} />
          <button className="primary" disabled={loading || !query.trim()}>{loading ? tr("Recherche…", "Searching…") : tr("Rechercher", "Search")}</button>
        </div>
      </form>
      <div className="media-suggestions" aria-label={tr("Idées de recherche", "Search ideas")}>
        <span>{tr("Explorer :", "Explore:")}</span>
        {suggestions[type].map((suggestion) => <button type="button" key={suggestion.label} onClick={() => { setQuery(suggestion.query); void searchFor(suggestion.query, type); }}>{suggestion.label}</button>)}
      </div>
      <p className="media-license-note">{tr("Résultats déclarés CC0 par leurs sources via Openverse. Ouvrez la fiche source pour vérifier la licence et les éventuels droits liés aux personnes ou marques visibles.", "Results are declared CC0 by their sources via Openverse. Open the source page to verify the license and any rights related to visible people or brands.")}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!loading && !error && results.length === 0 ? <p className="media-empty">{searched ? tr("Aucun résultat pour cette recherche. Essayez un autre terme.", "No results for this search. Try another term.") : tr("Lancez une recherche pour explorer la médiathèque.", "Start a search to explore the media library.")}</p> : null}
      <div className="media-results" aria-live="polite">
        {results.map((item) => (
          <article className="media-result" key={item.sourceUrl + item.url}>
            {type === "image" ? <img src={item.thumbnail} alt={item.title} loading="lazy" /> : <audio controls preload="none" src={item.url} aria-label={`${tr("Écouter", "Listen to")} ${item.title}`} />}
            <div className="media-result-copy">
              <b title={item.title}>{item.title}</b>
              <small>{item.creator} · CC0</small>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{tr("Vérifier la source", "Check source")} ↗</a>
              <button type="button" className="secondary" aria-pressed={(type === "image" ? design.heroImage : design.audio)?.url === item.url} onClick={() => choose(item)}>
                {(type === "image" ? design.heroImage : design.audio)?.url === item.url ? tr("✓ Sélectionné", "✓ Selected") : tr("Choisir", "Choose")}
              </button>
            </div>
          </article>
        ))}
      </div>
      {nextPage && activeSearch.current ? <button type="button" className="media-more" disabled={loading} onClick={() => {
        const current = activeSearch.current;
        if (current) void searchFor(current.term, current.mediaType, nextPage);
      }}>{loading ? tr("Chargement…", "Loading…") : tr("Voir plus de résultats", "Show more results")}</button> : null}
      {(design.heroImage || design.audio) ? (
        <div className="media-selected">
          {design.heroImage ? <div className="media-selected-item"><img src={design.heroImage.url} alt={tr("Aperçu de l’image choisie", "Selected image preview")} /><p><b>{tr("Image choisie :", "Selected image:")}</b> {design.heroImage.title} <button type="button" onClick={() => onChange({ ...design, heroImage: null })}>{tr("Retirer", "Remove")}</button></p></div> : null}
          {design.audio ? <div className="media-selected-item"><audio controls preload="none" src={design.audio.url} aria-label={`${tr("Écouter", "Listen to")} ${design.audio.title}`} /><p><b>{tr("Son choisi :", "Selected sound:")}</b> {design.audio.title} <button type="button" onClick={() => onChange({ ...design, audio: null })}>Retirer</button></p></div> : null}
        </div>
      ) : null}
    </div>
  );
}
