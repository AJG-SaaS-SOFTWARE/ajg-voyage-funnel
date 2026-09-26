import { type CSSProperties } from "react";
import { siteDisclaimer, type SiteConfig } from "../lib/site-config";
import SoundControl from "./SoundControl";
import SiteModulesView from "./SiteModulesView";
import { readableInk, safeHttpsUrl, surfaceInk } from "../lib/site-design";

export default function PublishedSite({ config }: { config: SiteConfig }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");
  const bookingHref = safeHttpsUrl(config.bookingUrl);
  const hasBooking = Boolean(config.design.showBooking && bookingHref && config.bookingLabel.trim());
  const instagramHref = config.design.showInstagram ? safeHttpsUrl(config.instagramUrl) : "";
  const facebookHref = config.design.showFacebook ? safeHttpsUrl(config.facebookUrl) : "";
  const english = config.language === "en";
  const actionLabel = config.bookingLabel;
  const { surface, ink } = surfaceInk(config.design);

  return (
    <div className="public-site" data-pattern={config.design.pattern} data-background={config.design.background} data-strength={config.design.patternStrength} style={{ "--site-accent": config.design.accent, "--site-accent-ink": readableInk(config.design.accent), "--site-pattern-color": config.design.patternColor || config.design.accent, "--site-surface": surface, "--site-ink": ink, "--site-muted": ink === "#ffffff" ? "#e5e9e8" : "#42545a", "--site-custom-background": surface } as CSSProperties}>
      <header className="public-header">
        <strong>{config.brandName || config.firstName + " " + config.lastName}</strong>
        <nav>
          {config.aboutText.trim() ? <a href="#presentation">{english ? "About" : "Présentation"}</a> : null}
          {hasBooking ? <a className="public-book" href={bookingHref} target="_blank" rel="noopener">{actionLabel} →</a> : null}
        </nav>
      </header>

      <main>
        <section className="public-hero" data-portrait={config.design.showPortrait ? "visible" : "hidden"}>
          {config.design.backgroundPhotoUrl || config.design.heroImage ? <img className="public-hero-image" src={config.design.backgroundPhotoUrl || config.design.heroImage!.url} alt="" style={{ objectPosition: `${config.design.backgroundPositionX}% ${config.design.backgroundPositionY}%` }} /> : null}
          <div className="public-hero-copy">
            {config.heroTagline.trim() ? <p className="mini">{config.heroTagline}</p> : null}
            <h1>{config.heroTitle || (english ? "Discover another way to travel" : "Découvrez une autre façon de voyager")}</h1>
            <p>{config.heroSubtitle}</p>
            <div className="public-actions">
              {hasBooking && config.design.showPrimaryButton ? <a className="button primary" href={bookingHref} target="_blank" rel="noopener">{actionLabel}</a> : null}
              {config.aboutText.trim() ? <a className="button public-secondary" href="#presentation">{english ? "About me" : "Qui suis-je ?"}</a> : null}
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

        {config.aboutText.trim() ? <section className="public-about" id="presentation">
          <p className="mini">{config.affiliation === "mwr" ? (english ? "Who is presenting the platform?" : "Qui vous présente la plateforme ?") : (english ? "About me" : "Qui suis-je ?")}</p>
          <h2>{config.aboutHeading || `${config.firstName} ${config.lastName}`}</h2>
          <p>{config.aboutText}</p>
        </section> : null}

        <SiteModulesView modules={config.design.modules} english={english} />

      </main>

      <footer className="public-footer">
        <strong>{config.brandName}</strong>
        {siteDisclaimer(config) ? <p>{siteDisclaimer(config)}</p> : null}
        {instagramHref || facebookHref ? <div className="public-socials">
          {instagramHref ? <a href={instagramHref} target="_blank" rel="noopener noreferrer">Instagram</a> : null}
          {facebookHref ? <a href={facebookHref} target="_blank" rel="noopener noreferrer">Facebook</a> : null}
        </div> : null}
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
