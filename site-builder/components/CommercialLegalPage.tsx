import Link from "next/link";
import {
  commercialLegalMissing,
  commercialLegalProfile,
  hostingProvider
} from "../lib/commercial-legal";
import styles from "./CommercialLegalPage.module.css";

type Locale = "fr" | "en";
type Kind = "legal" | "privacy" | "terms" | "cancel";

function value(value: string, locale: Locale) {
  return value || (locale === "fr" ? "À compléter avant le lancement payant" : "To be completed before paid launch");
}

export function CommercialLegalPage({ locale, kind }: { locale: Locale; kind: Kind }) {
  const fr = locale === "fr";
  const profile = commercialLegalProfile();
  const missing = commercialLegalMissing(profile);
  const draft = missing.length > 0 || process.env.AJG_COMMERCIAL_LEGAL_READY?.trim().toLowerCase() !== "true";
  const routes = fr
    ? { legal:"/mentions-legales", privacy:"/confidentialite", terms:"/cgv", cancel:"/resilier", pricing:"/tarifs" }
    : { legal:"/legal", privacy:"/privacy", terms:"/terms", cancel:"/cancel", pricing:"/pricing" };

  const title =
    kind === "legal" ? (fr ? "Mentions légales" : "Legal notice") :
    kind === "privacy" ? (fr ? "Politique de confidentialité" : "Privacy policy") :
    kind === "terms" ? (fr ? "Conditions générales de service" : "Terms of service") :
    fr ? "Résilier un abonnement" : "Cancel a subscription";

  return (
    <main className={styles.page} lang={locale}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}><span className={styles.mark}>A</span><span>ELTARA</span></Link>
        <nav className={styles.nav} aria-label={fr ? "Informations contractuelles" : "Contract information"}>
          <Link href={routes.legal}>{fr ? "Mentions légales" : "Legal"}</Link>
          <Link href={routes.privacy}>{fr ? "Confidentialité" : "Privacy"}</Link>
          <Link href={routes.terms}>{fr ? "CGS" : "Terms"}</Link>
          <Link href={routes.cancel}>{fr ? "Résiliation" : "Cancellation"}</Link>
          <Link href={routes.pricing}>{fr ? "Tarifs" : "Pricing"}</Link>
        </nav>
      </header>

      <div className={styles.main}>
        <p className={styles.kicker}>ELTARA · {fr ? "Cadre contractuel" : "Contract framework"}</p>
        <h1>{title}</h1>
        <p className={styles.lead}>
          {fr
            ? "Informations préparées pour le lancement commercial d’ELTARA. Les éléments dépendant de l’immatriculation finale du vendeur restent volontairement bloquants tant qu’ils ne sont pas renseignés."
            : "Information prepared for the commercial launch of ELTARA. Items that depend on the seller’s final registration deliberately remain launch blockers until completed."}
        </p>

        {draft ? (
          <p className={styles.draft} role="status">
            <strong>{fr ? "Version de préparation — aucun encaissement commercial n’est ouvert." : "Pre-launch version — commercial charging is not open."}</strong>{" "}
            {missing.length
              ? (fr ? "Informations encore requises : " : "Still required: ") + missing.join(", ") + "."
              : fr ? "La validation juridique finale n’a pas encore été activée." : "Final legal approval has not yet been enabled."}
          </p>
        ) : null}

        <article className={styles.article}>
          {kind === "legal" ? (
            <>
              <section className={styles.section}>
                <h2>{fr ? "Éditeur et fournisseur du service" : "Publisher and service provider"}</h2>
                <dl className={styles.data}>
                  <div><dt>{fr ? "Dénomination / identité" : "Legal name"}</dt><dd className={!profile.legalName ? styles.missing : ""}>{value(profile.legalName, locale)}</dd></div>
                  <div><dt>{fr ? "Nom commercial" : "Trading name"}</dt><dd>{profile.tradeName}</dd></div>
                  <div><dt>{fr ? "Forme juridique" : "Legal form"}</dt><dd className={!profile.legalForm ? styles.missing : ""}>{value(profile.legalForm, locale)}</dd></div>
                  {profile.shareCapital ? <div><dt>{fr ? "Capital social" : "Share capital"}</dt><dd>{profile.shareCapital}</dd></div> : null}
                  <div><dt>{fr ? "Adresse" : "Address"}</dt><dd className={!profile.address ? styles.missing : ""}>{value(profile.address, locale)}</dd></div>
                  <div><dt>Email</dt><dd className={!profile.email ? styles.missing : ""}>{value(profile.email, locale)}</dd></div>
                  <div><dt>{fr ? "Téléphone" : "Phone"}</dt><dd className={!profile.phone ? styles.missing : ""}>{value(profile.phone, locale)}</dd></div>
                  <div><dt>SIREN</dt><dd className={!profile.siren ? styles.missing : ""}>{value(profile.siren, locale)}</dd></div>
                  <div><dt>{fr ? "Immatriculation" : "Registration"}</dt><dd className={!profile.registration ? styles.missing : ""}>{value(profile.registration, locale)}</dd></div>
                  {profile.vatNumber ? <div><dt>{fr ? "TVA intracommunautaire" : "VAT number"}</dt><dd>{profile.vatNumber}</dd></div> : null}
                </dl>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Directeur de la publication" : "Publication director"}</h2>
                <p className={!profile.publicationDirector ? styles.missing : ""}>{value(profile.publicationDirector, locale)}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Hébergement" : "Hosting"}</h2>
                <p>{hostingProvider.name}<br />{hostingProvider.address}<br />{fr ? "Téléphone" : "Phone"}: {hostingProvider.phone}<br />{hostingProvider.website}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Propriété intellectuelle" : "Intellectual property"}</h2>
                <p>{fr
                  ? "Le logiciel, l’interface, la documentation et les éléments de marque ELTARA sont protégés par les droits applicables. Le client conserve ses droits sur les contenus, médias et signes distinctifs qu’il fournit, sous réserve des droits de tiers."
                  : "The software, interface, documentation and ELTARA brand assets are protected by applicable rights. Customers retain their rights in content, media and distinctive signs they provide, subject to third-party rights."}</p>
              </section>
            </>
          ) : null}

          {kind === "privacy" ? (
            <>
              <section className={styles.section}>
                <h2>{fr ? "Qui traite les données ?" : "Who processes the data?"}</h2>
                <p>{fr
                  ? "Pour les données de compte, de facturation, de support, de sécurité et de pilotage du produit, l’entité exploitant ELTARA agit comme responsable du traitement. Pour certains contenus et données de visiteurs traités uniquement pour publier le site d’un client, AJG peut agir comme sous-traitant du client."
                  : "For account, billing, support, security and product-operation data, the entity operating ELTARA acts as controller. For some content and visitor data processed solely to publish a customer website, AJG may act as the customer’s processor."}</p>
                <p><strong>{fr ? "Responsable :" : "Controller:"}</strong> <span className={!profile.legalName ? styles.missing : ""}>{value(profile.legalName, locale)}</span><br />
                <strong>{fr ? "Contact vie privée :" : "Privacy contact:"}</strong> <span className={!profile.privacyEmail ? styles.missing : ""}>{value(profile.privacyEmail, locale)}</span>
                {profile.dpoContact ? <><br /><strong>DPO:</strong> {profile.dpoContact}</> : null}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Données concernées" : "Data concerned"}</h2>
                <ul>
                  <li>{fr ? "Compte et authentification : e-mail, identifiant technique, informations nécessaires à la connexion." : "Account and authentication: email, technical identifier and information required to sign in."}</li>
                  <li>{fr ? "Création de site : identité de marque, textes, paramètres, brouillons, domaines et médias que vous choisissez d’enregistrer." : "Website creation: brand identity, copy, settings, drafts, domains and media you choose to save."}</li>
                  <li>{fr ? "IA : instructions, contexte utile et contenu nécessaires à la génération demandée, ainsi que la réponse produite." : "AI: instructions, relevant context and content required for the requested generation, plus the generated response."}</li>
                  <li>{fr ? "Facturation : références Stripe, formule, statut d’abonnement, échéances et événements de paiement ; les données de carte sont gérées par Stripe." : "Billing: Stripe references, plan, subscription status, dates and payment events; card data is handled by Stripe."}</li>
                  <li>{fr ? "Pilotage et sécurité : événements produit, quotas, erreurs, métriques techniques et données nécessaires à la prévention des abus." : "Operations and security: product events, quotas, errors, technical metrics and data needed to prevent abuse."}</li>
                </ul>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Finalités et bases légales" : "Purposes and legal bases"}</h2>
                <ul>
                  <li>{fr ? "Fournir le Builder, publier les sites, gérer le compte et l’abonnement : exécution du contrat ou mesures précontractuelles." : "Provide the Builder, publish websites, manage the account and subscription: performance of a contract or pre-contractual steps."}</li>
                  <li>{fr ? "Facturation, comptabilité et obligations réglementaires : obligation légale lorsque applicable." : "Billing, accounting and regulatory obligations: legal obligation where applicable."}</li>
                  <li>{fr ? "Sécurité, lutte contre les abus, amélioration opérationnelle et mesure d’usage : intérêt légitime, sous réserve des droits des personnes." : "Security, abuse prevention, operational improvement and usage measurement: legitimate interests, subject to individual rights."}</li>
                  <li>{fr ? "Communications non indispensables et traceurs non essentiels : consentement lorsqu’il est requis." : "Non-essential communications and non-essential trackers: consent where required."}</li>
                </ul>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Prestataires principaux" : "Main service providers"}</h2>
                <p>{fr
                  ? "Le fonctionnement actuel peut faire intervenir Supabase (base, authentification et stockage), Vercel (hébergement et exécution), Stripe (paiement et abonnements), Resend (e-mails transactionnels), OpenAI (fonctions de génération IA) et Vercel Blob pour certaines sauvegardes externes."
                  : "Current operation may involve Supabase (database, authentication and storage), Vercel (hosting and compute), Stripe (payments and subscriptions), Resend (transactional email), OpenAI (AI generation features), and Vercel Blob for some external backups."}</p>
                <p>{fr
                  ? "Les données envoyées à l’API OpenAI ne sont pas utilisées pour entraîner les modèles par défaut. Selon la configuration du compte et de l’endpoint, les requêtes/réponses ou journaux nécessaires au fonctionnement et à la prévention des abus peuvent être conservés jusqu’à 30 jours. AJG limite les données envoyées à ce qui est utile à la génération demandée."
                  : "Data sent to the OpenAI API is not used to train models by default. Depending on account and endpoint configuration, requests/responses or logs required for service operation and abuse prevention may be retained for up to 30 days. AJG limits data sent to what is useful for the requested generation."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Conservation" : "Retention"}</h2>
                <p>{fr
                  ? "Les données actives sont conservées pendant la fourniture du service. Une demande d’effacement peut être initiée depuis l’espace « Mes données ». Les éléments devant être conservés pour respecter une obligation légale, comptable, de sécurité ou pour établir des droits peuvent faire l’objet d’une conservation distincte et limitée. Les durées de production détaillées seront publiées avant l’ouverture payante."
                  : "Active data is retained while providing the service. An erasure request can be started from the “My data” area. Records that must be kept to meet legal, accounting or security obligations, or to establish legal rights, may be retained separately for a limited period. Detailed production retention periods will be published before paid launch."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Vos droits" : "Your rights"}</h2>
                <p>{fr
                  ? "Selon le traitement concerné, vous pouvez exercer vos droits d’accès, rectification, effacement, limitation, opposition et portabilité. Les utilisateurs disposent également d’un export et d’un parcours de demande d’effacement dans ELTARA. Vous pouvez introduire une réclamation auprès de la CNIL."
                  : "Depending on the processing involved, you may exercise rights of access, rectification, erasure, restriction, objection and portability. Users also have export and erasure-request tools in ELTARA. You may lodge a complaint with the French data protection authority, the CNIL."}</p>
              </section>
            </>
          ) : null}

          {kind === "terms" ? (
            <>
              <section className={styles.section}>
                <h2>{fr ? "1. Objet" : "1. Purpose"}</h2>
                <p>{fr
                  ? "ELTARA est un service en ligne de création, personnalisation, génération assistée par IA, hébergement et publication de sites web. Les présentes conditions encadreront l’utilisation payante du service une fois l’ouverture commerciale activée."
                  : "ELTARA is an online service for website creation, customization, AI-assisted generation, hosting and publishing. These terms will govern paid use once commercial launch is enabled."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "2. Offres, prix et aperçu" : "2. Plans, pricing and preview"}</h2>
                <p>{fr
                  ? "La grille préparée comprend Essentiel à 15 € par mois ou 150 € par an, Growth à 29 € par mois ou 290 € par an, et la Création IA complète à 49 € en paiement unique. Growth annuel peut inclure la Création IA. Le traitement fiscal final et l’affichage TTC applicable seront validés avant encaissement."
                  : "The prepared pricing grid includes Essential at €15/month or €150/year, Growth at €29/month or €290/year, and Full AI Launch at €49 as a one-time purchase. Annual Growth may include AI Launch. Final tax treatment and any required tax-inclusive display will be validated before charging begins."}</p>
                <p>{fr
                  ? "La Création IA complète est un droit BUILD ponctuel distinct de l’abonnement. ELTARA ne propose pas d’essai Stripe gratuit sur Essentiel ou Growth : le mode gratuit sert uniquement à produire un aperçu qualitatif, sans publication, hébergement, domaine personnalisé, export ni Création IA complète."
                  : "Full AI Launch is a one-time BUILD entitlement separate from the subscription. ELTARA does not offer a free Stripe trial on Essential or Growth: the free mode only provides a qualitative preview, without publishing, hosting, custom domains, export or Full AI Launch."}</p>
                <p>{fr
                  ? "Les Beta Testers invités restent hors facturation Stripe et ne sont pas engagés dans une offre payante du seul fait de leur participation à la bêta."
                  : "Invited Beta Testers remain outside Stripe billing and do not enter a paid plan merely by participating in the beta."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "3. Compte et sécurité" : "3. Account and security"}</h2>
                <p>{fr
                  ? "L’utilisateur est responsable de l’exactitude des informations de son compte et de la confidentialité de ses moyens d’accès. Il ne doit pas tenter de contourner les quotas, contrôles d’accès, restrictions de paiement ou mesures de sécurité."
                  : "Users are responsible for accurate account information and keeping access methods secure. They must not attempt to bypass quotas, access controls, payment restrictions or security measures."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "4. Contenus et IA" : "4. Content and AI"}</h2>
                <p>{fr
                  ? "Le client reste responsable des contenus qu’il publie, notamment de leur exactitude, de leurs droits d’utilisation et de leur conformité. Les fonctions IA proposent des brouillons et suggestions modifiables : elles ne remplacent pas une validation humaine, juridique, fiscale ou professionnelle."
                  : "Customers remain responsible for content they publish, including accuracy, usage rights and compliance. AI features provide editable drafts and suggestions and do not replace human, legal, tax or professional review."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "5. Disponibilité et évolution" : "5. Availability and changes"}</h2>
                <p>{fr
                  ? "AJG vise une disponibilité raisonnable du service et peut effectuer des opérations de maintenance, de sécurité ou d’évolution. Les fonctions, quotas et limites techniques peuvent évoluer, sous réserve des droits impératifs applicables et de l’information due au client."
                  : "AJG aims for reasonable service availability and may perform maintenance, security or product changes. Features, quotas and technical limits may evolve, subject to mandatory rights and any notice owed to the customer."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "6. Paiement, impayés et suspension" : "6. Payment, failed payments and suspension"}</h2>
                <p>{fr
                  ? "Stripe gère le paiement. En cas d’échec de paiement, AJG peut suspendre immédiatement les fonctions générant un coût, notamment l’IA, tout en appliquant les délais de grâce, restriction, suspension publique et export définis dans sa politique d’accès. Un impayé ne déclenche pas automatiquement l’effacement des données."
                  : "Stripe processes payments. If payment fails, AJG may immediately suspend cost-generating features such as AI while applying the grace, restriction, public-suspension and export periods defined in its access policy. A failed payment does not automatically erase data."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "7. Résiliation et rétractation" : "7. Cancellation and withdrawal"}</h2>
                <p>{fr
                  ? "La résiliation d’un abonnement est prévue depuis l’espace Facturation/Customer Portal et prend effet selon les conditions présentées au client, en principe à la fin de la période déjà payée. Une page de résiliation publique est également maintenue."
                  : "Subscription cancellation is available from Billing/Customer Portal and takes effect under the conditions shown to the customer, generally at the end of the already-paid period. A public cancellation page is also maintained."}</p>
                <p>{fr
                  ? "Lorsque le Code de la consommation s’applique, le droit légal de rétractation est distinct de l’essai commercial. Les informations et la fonctionnalité nécessaires seront activées avant toute vente à un consommateur."
                  : "Where consumer law applies, the statutory withdrawal right is separate from the commercial trial. The required information and withdrawal function will be enabled before any consumer sale."}</p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "8. Médiation et droit applicable" : "8. Mediation and applicable law"}</h2>
                {profile.consumerSalesEnabled ? (
                  <p>{profile.consumerMediatorName && profile.consumerMediatorUrl
                    ? (fr
                      ? `Pour les litiges éligibles relevant de la consommation, le médiateur désigné est ${profile.consumerMediatorName}, ${profile.consumerMediatorAddress}. Site : ${profile.consumerMediatorUrl}.`
                      : `For eligible consumer disputes, the designated mediator is ${profile.consumerMediatorName}, ${profile.consumerMediatorAddress}. Website: ${profile.consumerMediatorUrl}.`)
                    : (fr
                      ? "La vente aux consommateurs reste bloquée tant qu’un médiateur de la consommation compétent n’a pas été désigné et renseigné."
                      : "Consumer sales remain blocked until an eligible consumer mediator has been appointed and identified.")}</p>
                ) : (
                  <p>{fr
                    ? "La vente aux consommateurs n’est pas activée dans la configuration commerciale actuelle. Si elle est ouverte ultérieurement, les obligations de médiation et les droits impératifs des consommateurs seront ajoutés avant encaissement."
                    : "Consumer sales are not enabled in the current commercial configuration. If enabled later, mediation requirements and mandatory consumer rights will be added before charging."}</p>
                )}
                <p>{fr
                  ? "Le droit français est prévu comme droit applicable, sans priver un consommateur des protections impératives qui lui sont reconnues. La clause de juridiction applicable aux relations professionnelles sera finalisée avec l’identité juridique du vendeur."
                  : "French law is intended to apply without depriving consumers of mandatory protections available to them. The jurisdiction clause for professional relationships will be finalized together with the seller’s legal identity."}</p>
              </section>
            </>
          ) : null}

          {kind === "cancel" ? (
            <>
              <section className={styles.section}>
                <h2>{fr ? "Abonnements commerciaux" : "Commercial subscriptions"}</h2>
                <p>{fr
                  ? "Les paiements sont actuellement fermés pendant la bêta : aucun Beta Tester n’a besoin de résilier un abonnement payant ELTARA."
                  : "Payments are currently closed during beta: Beta Testers do not need to cancel a paid ELTARA subscription."}</p>
                <p>{fr
                  ? "Lorsque les abonnements seront ouverts, cette page restera l’entrée publique de résiliation. Un client disposant déjà d’un compte pourra s’identifier puis ouvrir le Customer Portal Stripe pour confirmer sa résiliation sans devoir créer un nouveau compte."
                  : "When subscriptions open, this page will remain the public cancellation entry point. An existing customer will be able to sign in and open the Stripe Customer Portal to confirm cancellation without creating a new account."}</p>
                <p><Link href="/login">{fr ? "Accéder à mon compte" : "Access my account"} →</Link></p>
              </section>
              <section className={styles.section}>
                <h2>{fr ? "Droit de rétractation" : "Right of withdrawal"}</h2>
                <p>{fr
                  ? "La vente aux consommateurs reste désactivée tant que le parcours légal de rétractation, l’identité du vendeur et le médiateur compétent ne sont pas finalisés. Une éventuelle période d’essai commerciale ne sera jamais présentée comme un remplacement du droit légal de rétractation."
                  : "Consumer sales remain disabled until the statutory withdrawal flow, seller identity and eligible mediator are finalized. Any commercial trial will never be presented as a replacement for a statutory withdrawal right."}</p>
              </section>
            </>
          ) : null}
        </article>

        <footer className={styles.footer}>
          <span>ELTARA · {fr ? "Version de préparation commerciale" : "Commercial pre-launch version"}</span>
          <span><Link href={routes.privacy}>{fr ? "Confidentialité" : "Privacy"}</Link> · <Link href={routes.terms}>{fr ? "Conditions" : "Terms"}</Link> · <Link href={routes.cancel}>{fr ? "Résiliation" : "Cancellation"}</Link></span>
        </footer>
      </div>
    </main>
  );
}
