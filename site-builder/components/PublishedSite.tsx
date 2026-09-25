import { requiredDisclaimer, type SiteConfig } from "../lib/site-config";

export default function PublishedSite({ config }: { config: SiteConfig }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");
  const bookingHref = config.bookingUrl || "#presentation";
  const english = config.language === "en";
  const actionLabel = config.bookingUrl
    ? config.bookingLabel || (english ? "Book a presentation" : "Réserver une présentation")
    : english ? "About me" : "En savoir plus";

  return (
    <div className="public-site">
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
      </footer>
    </div>
  );
}
