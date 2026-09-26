import { type CSSProperties } from "react";
import { siteDisclaimer, type SiteConfig } from "../lib/site-config";
import SoundControl from "./SoundControl";

export default function PublishedSite({ config }: { config: SiteConfig }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");
  const hasBooking = Boolean(config.bookingUrl && config.bookingLabel.trim());
  const bookingHref = config.bookingUrl;
  const english = config.language === "en";
  const actionLabel = config.bookingLabel;

  return (
    <div className="public-site" data-pattern={config.design.pattern} data-background={config.design.background} data-strength={config.design.patternStrength} style={{ "--site-accent": config.design.accent, "--site-pattern-color": config.design.patternColor || config.design.accent, ...(config.design.customBackgroundColor ? { "--site-custom-background": config.design.customBackgroundColor } : {}) } as CSSProperties}>
      <header className="public-header">
        <strong>{config.brandName || config.firstName + " " + config.lastName}</strong>
        <nav>
          <a href="#presentation">{english ? "About" : "Présentation"}</a>
          {hasBooking ? <a className="public-book" href={bookingHref} target="_blank" rel="noopener">{actionLabel} →</a> : null}
        </nav>
      </header>

      <main>
        <section className="public-hero" data-portrait={config.design.showPortrait ? "visible" : "hidden"}>
          {config.design.heroImage ? <img className="public-hero-image" src={config.design.heroImage.url} alt="" /> : null}
          <div className="public-hero-copy">
            <p className="mini">{config.heroTagline || (english ? "Travel first · discover next" : "Voyage d'abord · découverte ensuite")}</p>
            <h1>{config.heroTitle || (english ? "Discover another way to travel" : "Découvrez une autre façon de voyager")}</h1>
            <p>{config.heroSubtitle}</p>
            <div className="public-actions">
              {hasBooking ? <a className="button primary" href={bookingHref} target="_blank" rel="noopener">{actionLabel}</a> : null}
              <a className="button public-secondary" href="#presentation">{english ? "About me" : "Qui suis-je ?"}</a>
            </div>
            {config.design.audio ? <SoundControl audio={config.design.audio} english={english} /> : null}
          </div>
          {config.design.showPortrait ? <div className="public-portrait">
            {config.profileImageUrl ? (
              <img src={config.profileImageUrl} alt={`${config.firstName} ${config.lastName}`} />
            ) : (
              <span>{initials}</span>
            )}
          </div> : null}
        </section>

        <section className="public-about" id="presentation">
          <p className="mini">{config.affiliation === "mwr" ? (english ? "Who is presenting the platform?" : "Qui vous présente la plateforme ?") : (english ? "About me" : "Qui suis-je ?")}</p>
          <h2>{config.aboutHeading || `${config.firstName} ${config.lastName}`}</h2>
          <p>{config.aboutText}</p>
        </section>

      </main>

      <footer className="public-footer">
        <strong>{config.brandName}</strong>
        {siteDisclaimer(config) ? <p>{siteDisclaimer(config)}</p> : null}
        <div className="public-socials">
          {config.instagramUrl ? <a href={config.instagramUrl} target="_blank" rel="noopener">Instagram</a> : null}
          {config.facebookUrl ? <a href={config.facebookUrl} target="_blank" rel="noopener">Facebook</a> : null}
        </div>
        {config.affiliation === "mwr" && (config.design.showMwrLogo || config.design.showTravelAdvantageLogo) ? <div className="public-brand-marks">
          {config.design.showMwrLogo ? <img src="/logos/mwr-life-independent.svg" alt="MWR Life — distributeur indépendant" /> : null}
          {config.design.showTravelAdvantageLogo ? <img src="/logos/travel-advantage-independent.svg" alt="Travel Advantage — distributeur indépendant" /> : null}
        </div> : null}
        {(config.design.heroImage || config.design.audio) ? <div className="public-credits">
          {config.design.heroImage ? <a href={config.design.heroImage.sourceUrl} target="_blank" rel="noopener noreferrer">Image : {config.design.heroImage.title} — {config.design.heroImage.creator} ↗</a> : null}
          {config.design.audio ? <a href={config.design.audio.sourceUrl} target="_blank" rel="noopener noreferrer">Son : {config.design.audio.title} — {config.design.audio.creator} ↗</a> : null}
        </div> : null}
      </footer>
    </div>
  );
}
