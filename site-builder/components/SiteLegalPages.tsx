import Link from "next/link";
import type { SiteConfig } from "../lib/site-config";
import {
  effectivePrivacyEmail,
  effectivePublicationDirector,
  effectivePublisherName,
  hostingProvider
} from "../lib/site-legal";

export type LegalPageKind = "legal" | "privacy" | "cookies";

function LegalShell({ config, kind, children }: { config: SiteConfig; kind: LegalPageKind; children: React.ReactNode }) {
  const english = config.language === "en";
  const labels = english
    ? { home: "Back to site", legal: "Legal notice", privacy: "Privacy", cookies: "Cookies" }
    : { home: "Retour au site", legal: "Mentions légales", privacy: "Confidentialité", cookies: "Cookies" };
  return (
    <div className="site-legal-page">
      <header className="site-legal-header">
        <strong>{config.brandName || effectivePublisherName(config.legal, config.firstName, config.lastName)}</strong>
        <Link href={`/site/${encodeURIComponent(config.slug)}`}>{labels.home} →</Link>
      </header>
      <main className="site-legal-main">
        <nav className="site-legal-tabs" aria-label={english ? "Legal pages" : "Pages légales"}>
          <Link className={kind === "legal" ? "active" : ""} href={`/site/${encodeURIComponent(config.slug)}/mentions-legales`}>{labels.legal}</Link>
          <Link className={kind === "privacy" ? "active" : ""} href={`/site/${encodeURIComponent(config.slug)}/confidentialite`}>{labels.privacy}</Link>
          <Link className={kind === "cookies" ? "active" : ""} href={`/site/${encodeURIComponent(config.slug)}/cookies`}>{labels.cookies}</Link>
        </nav>
        {children}
      </main>
      <footer className="site-legal-footer">
        <span>{config.brandName}</span>
        <span>{english ? "Generated from information supplied by the site publisher." : "Pages générées à partir des informations fournies par l’éditeur du site."}</span>
      </footer>
    </div>
  );
}

export function LegalNoticePage({ config }: { config: SiteConfig }) {
  const english = config.language === "en";
  const legal = config.legal;
  const publisher = effectivePublisherName(legal, config.firstName, config.lastName);
  const director = effectivePublicationDirector(legal, config.firstName, config.lastName);

  return (
    <LegalShell config={config} kind="legal">
      <article className="site-legal-article">
        <p className="mini">{english ? "LEGAL INFORMATION" : "INFORMATIONS LÉGALES"}</p>
        <h1>{english ? "Legal notice" : "Mentions légales"}</h1>
        <p className="site-legal-lead">
          {english
            ? "This page identifies the publisher, publication director and hosting provider of this website."
            : "Cette page identifie l’éditeur, le directeur de la publication et l’hébergeur de ce site."}
        </p>

        <section>
          <h2>{english ? "Website publisher" : "Éditeur du site"}</h2>
          <dl className="site-legal-data">
            <div><dt>{english ? "Name" : "Identité"}</dt><dd>{publisher || "—"}</dd></div>
            {legal.tradeName ? <div><dt>{english ? "Trading name" : "Nom commercial"}</dt><dd>{legal.tradeName}</dd></div> : null}
            {legal.publisherType === "company" && legal.legalForm ? <div><dt>{english ? "Legal form" : "Forme juridique"}</dt><dd>{legal.legalForm}</dd></div> : null}
            {legal.publisherType === "company" && legal.shareCapital ? <div><dt>{english ? "Share capital" : "Capital social"}</dt><dd>{legal.shareCapital}</dd></div> : null}
            <div><dt>{english ? "Address" : "Adresse"}</dt><dd>{legal.address || "—"}</dd></div>
            <div><dt>Email</dt><dd>{legal.email || "—"}</dd></div>
            <div><dt>{english ? "Phone" : "Téléphone"}</dt><dd>{legal.phone || "—"}</dd></div>
            <div><dt>SIREN</dt><dd>{legal.siren || "—"}</dd></div>
            {legal.registrationDetails ? <div><dt>{english ? "Registration" : "Immatriculation"}</dt><dd>{legal.registrationDetails}</dd></div> : null}
            {legal.vatNumber ? <div><dt>{english ? "VAT number" : "TVA intracommunautaire"}</dt><dd>{legal.vatNumber}</dd></div> : null}
          </dl>
        </section>

        <section>
          <h2>{english ? "Publication director" : "Directeur de la publication"}</h2>
          <p>{director || "—"}</p>
        </section>

        {legal.regulatedActivity ? (
          <section>
            <h2>{english ? "Regulated activity" : "Activité réglementée"}</h2>
            {legal.professionalTitle ? <p><strong>{english ? "Professional title:" : "Titre professionnel :"}</strong> {legal.professionalTitle}</p> : null}
            {legal.professionalBody ? <p><strong>{english ? "Professional body:" : "Ordre / organisme professionnel :"}</strong> {legal.professionalBody}</p> : null}
            {legal.authorizationAuthority ? <p><strong>{english ? "Authority:" : "Autorité compétente :"}</strong> {legal.authorizationAuthority}</p> : null}
            {legal.professionalRules ? <p><strong>{english ? "Applicable professional rules:" : "Règles professionnelles applicables :"}</strong> {legal.professionalRules}</p> : null}
          </section>
        ) : null}

        <section>
          <h2>{english ? "Hosting provider" : "Hébergeur"}</h2>
          <p>{hostingProvider.name}<br />{hostingProvider.address}<br />{english ? "Phone" : "Téléphone"} : {hostingProvider.phone}<br />Site : {hostingProvider.website}</p>
        </section>

        <section>
          <h2>{english ? "Intellectual property" : "Propriété intellectuelle"}</h2>
          <p>
            {english
              ? "Unless otherwise stated in the credits displayed on the website, original texts and personal media remain the responsibility of the publisher. Third-party trademarks, logos, photographs, sounds and other media remain subject to their respective rights and licences."
              : "Sauf indication contraire dans les crédits affichés sur le site, les textes originaux et médias personnels restent sous la responsabilité de l’éditeur. Les marques, logos, photographies, sons et autres médias de tiers restent soumis aux droits et licences de leurs titulaires respectifs."}
          </p>
        </section>

        {legal.additionalLegalNote ? <section><h2>{english ? "Additional information" : "Information complémentaire"}</h2><p>{legal.additionalLegalNote}</p></section> : null}
      </article>
    </LegalShell>
  );
}

export function PrivacyPage({ config }: { config: SiteConfig }) {
  const english = config.language === "en";
  const legal = config.legal;
  const publisher = effectivePublisherName(legal, config.firstName, config.lastName);
  const privacyEmail = effectivePrivacyEmail(legal);
  const hasVideo = config.design.modules.video.enabled && Boolean(config.design.modules.video.url);
  const hasExternalLinks = Boolean(config.bookingUrl || config.instagramUrl || config.facebookUrl);
  const hasRemoteMedia = Boolean(config.design.heroImage || config.design.audio);

  return (
    <LegalShell config={config} kind="privacy">
      <article className="site-legal-article">
        <p className="mini">{english ? "PERSONAL DATA" : "DONNÉES PERSONNELLES"}</p>
        <h1>{english ? "Privacy policy" : "Politique de confidentialité"}</h1>
        <p className="site-legal-lead">
          {english
            ? "This notice explains how personal data may be processed when you visit this website."
            : "Cette notice explique comment des données personnelles peuvent être traitées lors de votre visite sur ce site."}
        </p>

        <section>
          <h2>{english ? "Data controller" : "Responsable du traitement"}</h2>
          <p>{publisher || "—"}{legal.address ? <><br />{legal.address}</> : null}{privacyEmail ? <><br />Contact : {privacyEmail}</> : null}</p>
          {legal.dpoContact ? <p><strong>DPO :</strong> {legal.dpoContact}</p> : null}
        </section>

        <section>
          <h2>{english ? "Data collected directly on this website" : "Données collectées directement sur ce site"}</h2>
          <p>
            {english
              ? "The public website generated by AJG Site Builder does not contain a native contact form, newsletter subscription or advertising tracker by default. Simply viewing the pages does not cause the publisher to receive the contents of your external accounts."
              : "Le site public généré par AJG Site Builder ne contient pas, par défaut, de formulaire de contact natif, d’inscription à une newsletter ni de traceur publicitaire. La simple consultation des pages ne transmet pas à l’éditeur le contenu de vos comptes sur des services externes."}
          </p>
        </section>

        <section>
          <h2>{english ? "Technical data and hosting" : "Données techniques et hébergement"}</h2>
          <p>
            {english
              ? "Technical connection data may be processed by the hosting provider for delivery, security, fraud prevention and service operation. Such processing is limited to what is necessary for operating and securing the service."
              : "Des données techniques de connexion peuvent être traitées par l’hébergeur pour l’acheminement des pages, la sécurité, la prévention des abus et le fonctionnement du service. Ces traitements sont limités à ce qui est nécessaire au fonctionnement et à la sécurisation du service."}
          </p>
          <p>{hostingProvider.name}, {hostingProvider.address}.</p>
        </section>

        {hasExternalLinks || hasVideo || hasRemoteMedia ? (
          <section>
            <h2>{english ? "Third-party services" : "Services tiers"}</h2>
            <p>
              {english
                ? "This website may contain links or media involving third-party services. These providers apply their own privacy rules when you choose to use their services."
                : "Ce site peut contenir des liens ou médias impliquant des services tiers. Ces prestataires appliquent leurs propres règles de confidentialité lorsque vous choisissez d’utiliser leurs services."}
            </p>
            <ul>
              {config.bookingUrl ? <li>{english ? "Appointment booking: external link selected by the publisher." : "Prise de rendez-vous : lien externe choisi par l’éditeur."}</li> : null}
              {config.instagramUrl || config.facebookUrl ? <li>{english ? "Social networks: external links only; no social widget is loaded automatically." : "Réseaux sociaux : liens externes uniquement ; aucun widget social n’est chargé automatiquement."}</li> : null}
              {hasVideo ? <li>{english ? "YouTube: the player is loaded only after the visitor explicitly asks to display the video." : "YouTube : le lecteur n’est chargé qu’après une action explicite du visiteur demandant l’affichage de la vidéo."}</li> : null}
              {hasRemoteMedia ? <li>{english ? "Media selected from an external library may involve a request to the media host when the resource is displayed." : "Les médias sélectionnés depuis une médiathèque externe peuvent entraîner une requête vers l’hébergeur du média lors de leur affichage."}</li> : null}
            </ul>
          </section>
        ) : null}

        <section>
          <h2>{english ? "Legal bases and retention" : "Bases légales et conservation"}</h2>
          <p>
            {english
              ? "Technical processing required to provide and secure the website is based on the legitimate interest in operating a secure online service. The public website does not store contact submissions by default. Data processed by third-party services is subject to their own retention periods and legal bases."
              : "Les traitements techniques nécessaires à la fourniture et à la sécurisation du site reposent sur l’intérêt légitime à exploiter un service en ligne sécurisé. Le site public ne conserve pas, par défaut, de demandes de contact. Les données éventuellement traitées par des services tiers sont soumises à leurs propres durées de conservation et bases légales."}
          </p>
        </section>

        <section>
          <h2>{english ? "Your rights" : "Vos droits"}</h2>
          <p>
            {english
              ? "Where applicable, you may exercise your rights of access, rectification, erasure, restriction, objection and, in the cases provided by law, portability. You may also lodge a complaint with the competent supervisory authority."
              : "Lorsque ces droits sont applicables, vous pouvez demander l’accès, la rectification, l’effacement ou la limitation de vos données, vous opposer à certains traitements et, dans les cas prévus par la réglementation, demander la portabilité. Vous pouvez également introduire une réclamation auprès de l’autorité de contrôle compétente."}
          </p>
          {privacyEmail ? <p><strong>{english ? "Exercise your rights:" : "Exercer vos droits :"}</strong> {privacyEmail}</p> : null}
          <p>{english ? "For France, the supervisory authority is the CNIL (Commission nationale de l’informatique et des libertés)." : "En France, l’autorité de contrôle est la CNIL (Commission nationale de l’informatique et des libertés)."}</p>
        </section>
      </article>
    </LegalShell>
  );
}

export function CookiesPage({ config }: { config: SiteConfig }) {
  const english = config.language === "en";
  const hasVideo = config.design.modules.video.enabled && Boolean(config.design.modules.video.url);

  return (
    <LegalShell config={config} kind="cookies">
      <article className="site-legal-article">
        <p className="mini">{english ? "COOKIES & TRACKERS" : "COOKIES & TRACEURS"}</p>
        <h1>{english ? "Cookie information" : "Informations sur les cookies"}</h1>
        <p className="site-legal-lead">
          {english
            ? "AJG public sites are designed to minimise trackers by default."
            : "Les sites publics AJG sont conçus pour limiter les traceurs par défaut."}
        </p>

        <section>
          <h2>{english ? "Default operation" : "Fonctionnement par défaut"}</h2>
          <p>
            {english
              ? "This website does not activate advertising, behavioural profiling or marketing audience measurement by default. A consent banner is therefore not displayed merely for decorative purposes when no non-essential tracker requires prior consent."
              : "Ce site n’active pas par défaut de publicité, de profilage comportemental ni de mesure d’audience marketing. Un bandeau de consentement n’est donc pas affiché uniquement pour la forme lorsqu’aucun traceur non essentiel ne nécessite un consentement préalable."}
          </p>
        </section>

        {hasVideo ? (
          <section>
            <h2>YouTube</h2>
            <p>
              {english
                ? "The YouTube player is not loaded on page arrival. It is loaded only when you explicitly choose to display the video. At that point, your browser may communicate with Google/YouTube, which applies its own cookie and privacy rules."
                : "Le lecteur YouTube n’est pas chargé à l’arrivée sur la page. Il est chargé uniquement lorsque vous choisissez explicitement d’afficher la vidéo. À ce moment-là, votre navigateur peut communiquer avec Google/YouTube, qui applique ses propres règles relatives aux cookies et à la confidentialité."}
            </p>
          </section>
        ) : null}

        <section>
          <h2>{english ? "Browser settings" : "Réglages du navigateur"}</h2>
          <p>
            {english
              ? "You can also delete or block cookies through your browser settings. Blocking strictly necessary technical storage may affect some website features."
              : "Vous pouvez également supprimer ou bloquer les cookies depuis les réglages de votre navigateur. Le blocage de stockages strictement nécessaires peut affecter certaines fonctions du site."}
          </p>
        </section>

        <section className="site-legal-notice">
          <strong>{english ? "Automatic compliance rule" : "Règle automatique AJG"}</strong>
          <p>
            {english
              ? "If AJG later enables a feature that requires prior consent (for example non-exempt analytics, advertising or an embedded third-party tracker), the site must display a consent mechanism before that feature is activated."
              : "Si AJG active ultérieurement une fonctionnalité nécessitant un consentement préalable (par exemple une mesure d’audience non exemptée, de la publicité ou un traceur tiers intégré), le site devra afficher un mécanisme de consentement avant l’activation de cette fonctionnalité."}
          </p>
        </section>
      </article>
    </LegalShell>
  );
}
