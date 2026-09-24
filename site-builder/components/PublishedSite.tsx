import { requiredDisclaimer, type SiteConfig } from "../lib/site-config";

export default function PublishedSite({ config }: { config: SiteConfig }) {
  const initials = (config.firstName?.[0] || "A") + (config.lastName?.[0] || "");
  const bookingHref = config.bookingUrl || "#presentation";

  return (
    <div className="public-site">
      <header className="public-header">
        <strong>{config.brandName || config.firstName + " " + config.lastName}</strong>
        <nav>
          {config.showTravelJournals ? <a href="#voyages">Mes voyages</a> : null}
          <a href="#presentation">Présentation</a>
          <a className="public-book" href={bookingHref} target={config.bookingUrl ? "_blank" : undefined} rel={config.bookingUrl ? "noopener" : undefined}>
            {config.bookingLabel || "Réserver"} →
          </a>
        </nav>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <p className="mini">Voyage d'abord · découverte ensuite</p>
            <h1>{config.heroTitle || "Découvrez une autre façon de voyager"}</h1>
            <p>{config.heroSubtitle}</p>
            <div className="public-actions">
              <a className="button primary" href={bookingHref} target={config.bookingUrl ? "_blank" : undefined} rel={config.bookingUrl ? "noopener" : undefined}>
                {config.bookingLabel || "Réserver une présentation"}
              </a>
              <a className="button public-secondary" href="#presentation">Qui suis-je ?</a>
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
          <p className="mini">Qui vous présente la plateforme ?</p>
          <h2>{config.firstName} {config.lastName}</h2>
          <p>{config.aboutText}</p>
        </section>

        {config.showTravelJournals ? (
          <section className="public-travels" id="voyages">
            <div>
              <p className="mini">Mes voyages</p>
              <h2>Des expériences personnelles à partager</h2>
              <p>Cette section accueillera les carnets, photos et impressions de voyage du membre.</p>
            </div>
            <div className="public-travel-placeholder">
              <span>Module carnets de voyage</span>
              <strong>Prêt pour la prochaine phase</strong>
            </div>
          </section>
        ) : null}
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
