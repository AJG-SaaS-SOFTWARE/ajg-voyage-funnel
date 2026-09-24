import { requiredDisclaimer, type SiteConfig } from "../lib/site-config";

export default function SitePreview({ config, compact = false }: { config: SiteConfig; compact?: boolean }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");

  return (
    <div className={compact ? "site-preview compact" : "site-preview"}>
      <nav>
        <strong>{config.brandName || "Votre site"}</strong>
        {config.showTravelJournals ? <span>Voyages</span> : null}
        <span>Présentation</span>
        <span>{config.language === "both" ? "FR · EN" : config.language.toUpperCase()}</span>
      </nav>

      <section className="preview-hero">
        <div>
          <p className="mini">Voyage d'abord · découverte ensuite</p>
          <h3>{config.heroTitle || "Votre titre"}</h3>
          <p>{config.heroSubtitle || "Votre texte d'introduction."}</p>
          <button type="button">{config.bookingLabel || "Réserver"}</button>
        </div>
        <div className="portrait">
          {config.profileImageUrl ? <img src={config.profileImageUrl} alt="" /> : <span>{initials}</span>}
        </div>
      </section>

      <section className="preview-about">
        <p className="mini">Qui suis-je ?</p>
        <h4>{config.firstName} {config.lastName}</h4>
        <p>{config.aboutText}</p>
      </section>

      {config.showTravelJournals ? (
        <section className="preview-trips">
          <p className="mini">Mes voyages</p>
          <div className="trip-grid">
            <article><b>Premier carnet</b><span>Photos & impressions</span></article>
            <article><b>Deuxième carnet</b><span>À personnaliser</span></article>
          </div>
        </section>
      ) : null}

      <footer>{requiredDisclaimer}</footer>
    </div>
  );
}
