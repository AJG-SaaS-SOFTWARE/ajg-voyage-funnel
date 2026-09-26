import { type CSSProperties } from "react";
import { siteDisclaimer, type SiteConfig } from "../lib/site-config";
import SiteModulesView from "./SiteModulesView";
import { readableInk, surfaceInk } from "../lib/site-design";

export default function SitePreview({ config, compact = false }: { config: SiteConfig; compact?: boolean }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");
  const english = config.language === "en";
  const { surface, ink } = surfaceInk(config.design);

  return (
    <div className={compact ? "site-preview compact" : "site-preview"} data-pattern={config.design.pattern} data-background={config.design.background} data-strength={config.design.patternStrength} style={{ "--site-accent": config.design.accent, "--site-accent-ink": readableInk(config.design.accent), "--site-pattern-color": config.design.patternColor || config.design.accent, "--site-surface": surface, "--site-ink": ink, "--site-muted": ink === "#ffffff" ? "#e5e9e8" : "#42545a", "--site-custom-background": surface } as CSSProperties}>
      <nav>
        <strong>{config.brandName || (english ? "Your site" : "Votre site")}</strong>
        {config.aboutText.trim() ? <span>{english ? "About" : "Présentation"}</span> : null}
        <span>{config.language === "both" ? "FR · EN" : config.language.toUpperCase()}</span>
      </nav>

      <section className="preview-hero" data-portrait={config.design.showPortrait ? "visible" : "hidden"}>
        {config.design.backgroundPhotoUrl || config.design.heroImage ? <img className="preview-hero-image" src={config.design.backgroundPhotoUrl || config.design.heroImage!.url} alt="" style={{ objectPosition: `${config.design.backgroundPositionX}% ${config.design.backgroundPositionY}%` }} /> : null}
        <div>
          {config.heroTagline.trim() ? <p className="mini">{config.heroTagline}</p> : null}
          <h3>{config.heroTitle || (english ? "Your headline" : "Votre titre")}</h3>
          <p>{config.heroSubtitle || "Votre texte d'introduction."}</p>
          {config.design.showBooking && config.design.showPrimaryButton && config.bookingUrl && config.bookingLabel.trim() ? <button type="button">{config.bookingLabel}</button> : null}
          {config.design.audio ? <p className="preview-sound">♫ {config.design.audio.title}</p> : null}
        </div>
        {config.design.showPortrait ? <div className="portrait">
          {config.profileImageUrl ? <img src={config.profileImageUrl} alt="" /> : <span>{initials}</span>}
        </div> : null}
      </section>

      <SiteModulesView modules={config.design.modules} english={english} />

      {config.aboutText.trim() ? <section className="preview-about">
        <p className="mini">{english ? "About me" : "Qui suis-je ?"}</p>
        <h4>{config.aboutHeading || `${config.firstName} ${config.lastName}`}</h4>
        <p>{config.aboutText}</p>
      </section> : null}


      <footer>
        {siteDisclaimer(config)}
        {config.affiliation === "mwr" && (config.design.showMwrLogo || config.design.showTravelAdvantageLogo) ? <div className="preview-brand-marks">
          {config.design.showMwrLogo ? <img src="/logos/mwr-life-independent.svg" alt="MWR Life — distributeur indépendant" /> : null}
          {config.design.showTravelAdvantageLogo ? <img src="/logos/travel-advantage-independent.svg" alt="Travel Advantage — distributeur indépendant" /> : null}
        </div> : null}
      </footer>
    </div>
  );
}
