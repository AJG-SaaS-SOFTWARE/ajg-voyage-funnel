"use client";

import type { SiteLegalConfig } from "../lib/site-legal";
import { useProductLocale } from "../lib/product-i18n";

type Props = {
  value: SiteLegalConfig;
  firstName: string;
  lastName: string;
  affiliation: "mwr" | "independent";
  onChange: (value: SiteLegalConfig) => void;
};

export default function ComplianceEditor({ value, firstName, lastName, affiliation, onChange }: Props) {
  const { tr } = useProductLocale();
  const update = <K extends keyof SiteLegalConfig>(key: K, next: SiteLegalConfig[K]) => onChange({ ...value, [key]: next });
  const individualName = `${firstName} ${lastName}`.trim();
  const effectiveName = value.legalName || (value.publisherType === "individual" ? individualName : "");
  const effectiveDirector = value.publicationDirector || (value.publisherType === "individual" ? effectiveName : "");
  const effectivePrivacy = value.privacyEmail || value.email;

  return (
    <div className="compliance-editor">
      <div className="compliance-intro">
        <div>
          <span className="mini">{tr("CONFORMITÉ FRANCE · UE", "FRANCE · EU COMPLIANCE")}</span>
          <h3>{tr("Informations légales du site", "Website legal information")}</h3>
          <p>{tr("AJG génère les pages Mentions légales, Confidentialité et Cookies à partir de ces informations. Elles ne remplacent pas un conseil juridique si votre activité a des obligations particulières.", "AJG generates the Legal notice, Privacy and Cookies pages from this information. This does not replace legal advice if your activity has specific obligations.")}</p>
        </div>
        <span className="compliance-badge">{tr("RGPD assisté", "GDPR assisted")}</span>
      </div>

      <div className="compliance-grid">
        <label>
          <span>{tr("Type d’éditeur", "Publisher type")}</span>
          <select value={value.publisherType} onChange={(e) => update("publisherType", e.target.value as SiteLegalConfig["publisherType"])}>
            <option value="individual">{tr("Entrepreneur individuel / personne physique", "Individual / sole trader")}</option>
            <option value="company">{tr("Société / personne morale", "Company / legal entity")}</option>
          </select>
        </label>

        <label>
          <span>{tr("Nature principale de l’activité", "Main activity type")}</span>
          <select value={value.activityKind} onChange={(e) => update("activityKind", e.target.value as SiteLegalConfig["activityKind"])}>
            <option value="commercial">{tr("Commerciale", "Commercial")}</option>
            <option value="artisan">{tr("Artisanale", "Craft / artisan")}</option>
            <option value="liberal">{tr("Libérale", "Liberal profession")}</option>
            <option value="other">{tr("Autre / à vérifier", "Other / to verify")}</option>
          </select>
        </label>
      </div>

      <div className="compliance-grid">
        <label>
          <span>{value.publisherType === "company" ? tr("Raison sociale", "Legal company name") : tr("Nom légal de l’éditeur", "Publisher legal name")}</span>
          <input value={value.legalName} onChange={(e) => update("legalName", e.target.value)} placeholder={value.publisherType === "individual" ? individualName || tr("Prénom Nom", "First Last") : tr("Nom de la société", "Company name")} />
          {value.publisherType === "individual" && !value.legalName && individualName ? <small>{tr("AJG utilisera automatiquement", "AJG will automatically use")} « {individualName} ».</small> : null}
        </label>
        <label>
          <span>{tr("Nom commercial", "Trade name")} <em>{tr("facultatif", "optional")}</em></span>
          <input value={value.tradeName} onChange={(e) => update("tradeName", e.target.value)} placeholder="Ex. AJG Voyage" />
        </label>
      </div>

      {value.publisherType === "company" ? (
        <div className="compliance-grid">
          <label><span>{tr("Forme juridique", "Legal form")}</span><input value={value.legalForm} onChange={(e) => update("legalForm", e.target.value)} placeholder="Ex. SAS, SARL, EURL…" /></label>
          <label><span>{tr("Capital social", "Share capital")}</span><input value={value.shareCapital} onChange={(e) => update("shareCapital", e.target.value)} placeholder="Ex. 10 000 €" /></label>
        </div>
      ) : null}

      <label className="compliance-full">
        <span>{tr("Adresse professionnelle / siège social", "Business address / registered office")}</span>
        <textarea rows={2} value={value.address} onChange={(e) => update("address", e.target.value)} placeholder={tr("Adresse complète à faire apparaître dans les mentions légales", "Full address to display in the legal notice")} />
        <small>{tr("Cette adresse sera publique sur la page Mentions légales. Utilisez votre adresse professionnelle ou une adresse de domiciliation adaptée à votre situation.", "This address will be public on the Legal notice page. Use your business address or a suitable registered address.")}</small>
      </label>

      <div className="compliance-grid">
        <label><span>{tr("E-mail professionnel", "Business email")}</span><input type="email" value={value.email} onChange={(e) => update("email", e.target.value)} placeholder="contact@exemple.fr" /></label>
        <label><span>{tr("Téléphone professionnel", "Business phone")}</span><input type="tel" value={value.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+33 …" /></label>
      </div>

      <div className="compliance-grid">
        <label><span>SIREN</span><input value={value.siren} onChange={(e) => update("siren", e.target.value)} placeholder={tr("9 chiffres", "9 digits")} inputMode="numeric" /></label>
        <label>
          <span>{value.activityKind === "artisan" ? tr("Immatriculation RNE", "RNE registration") : tr("Immatriculation RCS / RNE", "RCS / RNE registration")} {["commercial","artisan"].includes(value.activityKind) ? "" : <em>{tr("si applicable", "if applicable")}</em>}</span>
          <input value={value.registrationDetails} onChange={(e) => update("registrationDetails", e.target.value)} placeholder="Ex. RCS Rodez 123 456 789 / RNE 123 456 789" />
        </label>
      </div>

      <div className="compliance-grid">
        <label><span>{tr("N° TVA intracommunautaire", "EU VAT number")} <em>{tr("si applicable", "if applicable")}</em></span><input value={value.vatNumber} onChange={(e) => update("vatNumber", e.target.value)} placeholder="Ex. FR…" /></label>
        <label>
          <span>{tr("Directeur de la publication", "Publication director")}</span>
          <input value={value.publicationDirector} onChange={(e) => update("publicationDirector", e.target.value)} placeholder={value.publisherType === "individual" ? effectiveName || tr("Prénom Nom", "First Last") : tr("Nom du représentant légal", "Legal representative name")} />
          {value.publisherType === "individual" && !value.publicationDirector && effectiveDirector ? <small>{tr("AJG utilisera automatiquement", "AJG will automatically use")} « {effectiveDirector} ».</small> : null}
        </label>
      </div>

      <label className="compliance-regulated">
        <input type="checkbox" checked={value.regulatedActivity} onChange={(e) => update("regulatedActivity", e.target.checked)} />
        <span><b>{tr("Mon activité est réglementée ou soumise à autorisation", "My activity is regulated or subject to authorization")}</b><small>{tr("Activez si votre profession impose un titre, un ordre, un organisme professionnel, une autorisation ou des règles professionnelles spécifiques.", "Enable this if your profession requires a title, professional body, authorization or specific professional rules.")}</small></span>
      </label>

      {value.regulatedActivity ? (
        <div className="compliance-regulated-fields">
          <div className="compliance-grid">
            <label><span>{tr("Titre professionnel", "Professional title")}</span><input value={value.professionalTitle} onChange={(e) => update("professionalTitle", e.target.value)} placeholder={tr("Titre professionnel exact", "Exact professional title")} /></label>
            <label><span>{tr("Ordre / organisme professionnel", "Professional body / association")}</span><input value={value.professionalBody} onChange={(e) => update("professionalBody", e.target.value)} placeholder={tr("Nom de l’ordre ou organisme", "Name of professional body")} /></label>
          </div>
          <label className="compliance-full"><span>{tr("Autorité ayant délivré l’autorisation", "Authorizing authority")} <em>si applicable</em></span><input value={value.authorizationAuthority} onChange={(e) => update("authorizationAuthority", e.target.value)} placeholder={tr("Nom et adresse de l’autorité", "Authority name and address")} /></label>
          <label className="compliance-full"><span>{tr("Règles professionnelles applicables", "Applicable professional rules")}</span><textarea rows={3} value={value.professionalRules} onChange={(e) => update("professionalRules", e.target.value)} placeholder={tr("Référence ou lien vers les règles professionnelles applicables", "Reference or link to applicable professional rules")} /></label>
        </div>
      ) : null}

      <div className="compliance-divider" />

      <div className="compliance-grid">
        <label>
          <span>{tr("Contact pour les droits RGPD", "GDPR rights contact")}</span>
          <input type="email" value={value.privacyEmail} onChange={(e) => update("privacyEmail", e.target.value)} placeholder={value.email || "privacy@exemple.fr"} />
          {!value.privacyEmail && effectivePrivacy ? <small>{tr("AJG utilisera l’e-mail professionnel ci-dessus.", "AJG will use the business email above.")}</small> : null}
        </label>
        <label><span>{tr("DPO / Délégué à la protection des données", "DPO / Data Protection Officer")} <em>{tr("si désigné", "if appointed")}</em></span><input value={value.dpoContact} onChange={(e) => update("dpoContact", e.target.value)} placeholder={tr("Nom ou e-mail du DPO", "DPO name or email")} /></label>
      </div>

      <label className="compliance-full">
        <span>{tr("Mention légale complémentaire", "Additional legal notice")} <em>{tr("facultatif", "optional")}</em></span>
        <textarea rows={3} value={value.additionalLegalNote} onChange={(e) => update("additionalLegalNote", e.target.value)} placeholder={tr("Ajoutez ici une obligation propre à votre activité si nécessaire.", "Add any activity-specific legal requirement here if necessary.")} />
      </label>

      <div className="privacy-by-default-note">
        <b>{tr("Protection des données par défaut", "Privacy by default")}</b>
        <p>{tr("Les sites AJG n’activent pas de publicité ni de mesure d’audience marketing par défaut. Les vidéos YouTube sont chargées seulement après action du visiteur. Les liens Calendly, Instagram, Facebook ou autres services externes ouvrent ces services tiers sans stocker leurs données dans AJG.", "AJG websites do not enable advertising or marketing analytics by default. YouTube videos load only after visitor action. Calendly, Instagram, Facebook and other external links open those third-party services without storing their data in AJG.")}</p>
      </div>

      {affiliation === "mwr" ? (
        <div className="compliance-mwr-note">
          <b>{tr("Profil MWR Life", "MWR Life profile")}</b>
          <p>{tr("Ces informations légales complètent la mention d’indépendance MWR Life ; elles ne la remplacent pas.", "This legal information complements the MWR Life independence disclosure; it does not replace it.")}</p>
        </div>
      ) : null}

      <label className={`compliance-confirm ${value.confirmedAccuracy ? "confirmed" : ""}`}>
        <input type="checkbox" checked={value.confirmedAccuracy} onChange={(e) => update("confirmedAccuracy", e.target.checked)} />
        <span><b>{tr("Je confirme que ces informations correspondent à ma situation actuelle", "I confirm that this information matches my current situation")}</b><small>{tr("AJG peut structurer et afficher ces informations, mais ne peut pas vérifier votre statut juridique, vos numéros ou vos obligations professionnelles à votre place.", "AJG can structure and display this information, but cannot verify your legal status, registration numbers or professional obligations for you.")}</small></span>
      </label>
    </div>
  );
}
