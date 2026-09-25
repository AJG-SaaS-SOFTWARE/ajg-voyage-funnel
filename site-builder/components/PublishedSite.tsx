import { type CSSProperties } from "react";
import { requiredDisclaimer, type SiteConfig } from "../lib/site-config";
import SoundControl from "./SoundControl";

export default function PublishedSite({ config }: { config: SiteConfig }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");
  const bookingHref = config.bookingUrl || "#presentation";
  const english = config.language === "en";
  const actionLabel = config.bookingUrl
    ? config.bookingLabel || (english ? "Book a presentation" : "Réserver une présentation")
    : english ? "About me" : "En savoir plus";

  return (
    <div className="public-site" data-pattern={config.design.pattern} style={{ "--site-accent": config.design.accent } as CSSProperties}>
      <header className="public-header">
        <strong>{config.brandName || config.firstName + " " + config.lastName}</strong>
        <nav>
          <a href="#presentation">{english ? "About" : "Présentation"}</a>
          <a className="public-book" href={bookingHref} target={config.bookingUrl ? "_blank" : undefined} rel={config.bookingUrl ? "noopener" : undefined}>
            {actionLabel} →
          </a>
        </nav>
      </header>

      <main>
        <section className="public-hero">
          {config.design.heroImage ? <img className="public-hero-image" src={config.design.heroImage.url} alt="" /> : null}
          <div className="public-hero-copy">
            <p className="mini">{english ? "Travel first · discover next" : "Voyage d\'abord · découverte ensuite"}</p>
            <h1>{config.heroTitle || (english ? "Discover another way to travel" : "Découvrez une autre façon de voyager")}</h1>
            <p>{config.heroSubtitle}</p>
            <div className="public-actions">
              <a className="button primary" href={bookingHref} target={config.bookingUrl ? "_blank" : undefined} rel={config.bookingUrl ? "noopener" : undefined}>
                {actionLabel}
              </a>
              <a className="button public-secondary" href="#presentation">{english ? "About me" : "Qui suis-je ?"}</a>
            </div>
            {config.design.audio ? <SoundControl audio={config.design.audio} english={english} /> : null}
          </div>
          <div className="public-portrait">
            {config.profileImageUrl ? (
              <img src={config.profileImageUrl} alt={`${config.firstName} ${config.lastName}`} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
        </section>

        <section className="public-about" id="presentation">
          <p className="mini">{english ? "Who is presenting the platform?" : "Qui vous présente la plateforme ?"}</p>
          <h2>{config.firstName} {config.lastName}</h2>
          <p>{config.aboutText}</p>
        </section>

      </main>

      <footer className="public-footer">
        <strong>{config.brandName}</strong>
        <p>{requiredDisclaimer}</p>
        <div className="public-socials">
          {config.instagramUrl ? <a href={config.instagramUrl} target="_blank" rel="noopener">Instagram</a> : null}
          {config.facebookUrl ? <a href={config.facebookUrl} target="_blank" rel="noopener">Facebook</a> : null}
        </div>
        {(config.design.heroImage || config.design.audio) ? <div className="public-credits">
          {config.design.heroImage ? <a href={config.design.heroImage.sourceUrl} target="_blank" rel="noopener noreferrer">Image : {config.design.heroImage.title} — {config.design.heroImage.creator} ↗</a> : null}
          {config.design.audio ? <a href={config.design.audio.sourceUrl} target="_blank" rel="noopener noreferrer">Son : {config.design.audio.title} — {config.design.audio.creator} ↗</a> : null}
        </div> : null}
      </footer>
    </div>
  );
}
