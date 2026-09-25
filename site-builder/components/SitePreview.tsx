import { type CSSProperties } from "react";
import { requiredDisclaimer, type SiteConfig } from "../lib/site-config";

export default function SitePreview({ config, compact = false }: { config: SiteConfig; compact?: boolean }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");
  const english = config.language === "en";

  return (
    <div className={compact ? "site-preview compact" : "site-preview"} data-pattern={config.design.pattern} style={{ "--site-accent": config.design.accent } as CSSProperties}>
      <nav>
        <strong>{config.brandName || (english ? "Your site" : "Votre site")}</strong>
        <span>{english ? "About" : "Présentation"}</span>
        <span>{config.language === "both" ? "FR · EN" : config.language.toUpperCase()}</span>
      </nav>

      <section className="preview-hero">
        {config.design.heroImage ? <img className="preview-hero-image" src={config.design.heroImage.url} alt="" /> : null}
        <div>
          <p className="mini">{english ? "Travel first · discover next" : "Voyage d\'abord · découverte ensuite"}</p>
          <h3>{config.heroTitle || (english ? "Your headline" : "Votre titre")}</h3>
          <p>{config.heroSubtitle || "Votre texte d'introduction."}</p>
          <button type="button">{config.bookingUrl
            ? config.bookingLabel || (english ? "Book" : "Réserver")
            : english ? "About me" : "En savoir plus"}</button>
          {config.design.audio ? <p className="preview-sound">♫ {config.design.audio.title}</p> : null}
        </div>
        <div className="portrait">
          {config.profileImageUrl ? <img src={config.profileImageUrl} alt="" /> : <span>{initials}</span>}
        </div>
      </section>

      <section className="preview-about">
        <p className="mini">{english ? "About me" : "Qui suis-je ?"}</p>
        <h4>{config.firstName} {config.lastName}</h4>
        <p>{config.aboutText}</p>
      </section>


      <footer>{requiredDisclaimer}</footer>
    </div>
  );
}
