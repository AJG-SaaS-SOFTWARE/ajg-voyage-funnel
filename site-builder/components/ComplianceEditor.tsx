"use client";

import type { SiteLegalConfig } from "../lib/site-legal";
import { useUiLanguage } from "./LanguageProvider";

type Props = {
  value: SiteLegalConfig;
  firstName: string;
  lastName: string;
  affiliation: "mwr" | "independent";
  onChange: (value: SiteLegalConfig) => void;
};

export default function ComplianceEditor({ value, firstName, lastName, affiliation, onChange }: Props) {
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const update = <K extends keyof SiteLegalConfig>(key: K, next: SiteLegalConfig[K]) => onChange({ ...value, [key]: next });
  const individualName = `${firstName} ${lastName}`.trim();
  const effectiveName = value.legalName || (value.publisherType === "individual" ? individualName : "");
  const effectiveDirector = value.publicationDirector || (value.publisherType === "individual" ? effectiveName : "");
  const effectivePrivacy = value.privacyEmail || value.email;

  return (
    <div className="compliance-editor">
      <div className="compliance-intro">
        <div>
          <span className="mini">{en ? "FRANCE · EU COMPLIANCE" : "CONFORMITÉ FRANCE · UE"}</span>
          <h3>{en ? "Website legal information" : "Informations légales du site"}</h3>
          <p>{en ? "AJG generates the Legal Notice, Privacy and Cookies pages from this information. They do not replace legal advice if your activity has specific obligations." : "AJG génère les pages Mentions légales, Confidentialité et Cookies à partir de ces informations. Elles ne remplacent pas un conseil juridique si votre activité a des obligations particulières."}</p>
        </div>
        <span className="compliance-badge">{en ? "GDPR assisted" : "RGPD assisté"}</span>
      </div>

      <div className="compliance-grid">
        <label>
          <span>{en ? "Publisher type" : "Type d’éditeur"}</span>
          <select value={value.publisherType} onChange={(e) => update("publisherType", e.target.value as SiteLegalConfig["publisherType"])}>
            <option value="individual">{en ? "Sole trader / individual" : "Entrepreneur individuel / personne physique"}</option>
            <option value="company">{en ? "Company / legal entity" : "Société / personne morale"}</option>
          </select>
        </label>

        <label>
          <span>{en ? "Main activity type" : "Nature principale de l’activité"}</span>
          <select value={value.activityKind} onChange={(e) => update("activityKind", e.target.value as SiteLegalConfig["activityKind"])}>
            <option value="commercial">{en ? "Commercial" : "Commerciale"}</option>
            <option value="artisan">{en ? "Craft / trade" : "Artisanale"}</option>
            <option value="liberal">{en ? "Liberal profession" : "Libérale"}</option>
            <option value="other">{en ? "Other / to check" : "Autre / à vérifier"}</option>
          </select>
        </label>
      </div>

      <div className="compliance-grid">
        <label>
          <span>{value.publisherType === "company" ? (en ? "Legal company name" : "Raison sociale") : (en ? "Publisher legal name" : "Nom légal de l’éditeur")}</span>
          <input value={value.legalName} onChange={(e) => update("legalName", e.target.value)} placeholder={value.publisherType === "individual" ? individualName || (en ? "First name Last name" : "Prénom Nom") : (en ? "Company name" : "Nom de la société")} />
          {value.publisherType === "individual" && !value.legalName && individualName ? <small>{en ? <>AJG will automatically use “{individualName}”.</> : <>AJG utilisera automatiquement « {individualName} ».</>}</small> : null}
        </label>
        <label>
          <span>{en ? "Trading name" : "Nom commercial"} <em>{en ? "optional" : "facultatif"}</em></span>
          <input value={value.tradeName} onChange={(e) => update("tradeName", e.target.value)} placeholder={en ? "E.g. AJG Voyage" : "Ex. AJG Voyage"} />
        </label>
      </div>

      {value.publisherType === "company" ? (
        <div className="compliance-grid">
          <label><span>{en ? "Legal form" : "Forme juridique"}</span><input value={value.legalForm} onChange={(e) => update("legalForm", e.target.value)} placeholder={en ? "E.g. SAS, SARL, EURL…" : "Ex. SAS, SARL, EURL…"} /></label>
          <label><span>{en ? "Share capital" : "Capital social"}</span><input value={value.shareCapital} onChange={(e) => update("shareCapital", e.target.value)} placeholder={en ? "E.g. €10,000" : "Ex. 10 000 €"} /></label>
        </div>
      ) : null}

      <label className="compliance-full">
        <span>{en ? "Business / registered office address" : "Adresse professionnelle / siège social"}</span>
        <textarea rows={2} value={value.address} onChange={(e) => update("address", e.target.value)} placeholder={en ? "Full address to display in the legal notice" : "Adresse complète à faire apparaître dans les mentions légales"} />
        <small>{en ? "This address will be public on the Legal Notice page. Use your business address or a suitable registered address." : "Cette adresse sera publique sur la page Mentions légales. Utilisez votre adresse professionnelle ou une adresse de domiciliation adaptée à votre situation."}</small>
      </label>

      <div className="compliance-grid">
        <label><span>{en ? "Business email" : "E-mail professionnel"}</span><input type="email" value={value.email} onChange={(e) => update("email", e.target.value)} placeholder={en ? "contact@example.com" : "contact@exemple.fr"} /></label>
        <label><span>{en ? "Business phone" : "Téléphone professionnel"}</span><input type="tel" value={value.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+33 …" /></label>
      </div>

      <div className="compliance-grid">
        <label><span>SIREN</span><input value={value.siren} onChange={(e) => update("siren", e.target.value)} placeholder="9 chiffres" inputMode="numeric" /></label>
        <label>
          <span>{value.activityKind === "artisan" ? "Immatriculation RNE" : "Immatriculation RCS / RNE"} {["commercial","artisan"].includes(value.activityKind) ? "" : <em>si applicable</em>}</span>
          <input value={value.registrationDetails} onChange={(e) => update("registrationDetails", e.target.value)} placeholder="Ex. RCS Rodez 123 456 789 / RNE 123 456 789" />
        </label>
      </div>

      <div className="compliance-grid">
        <label><span>N° TVA intracommunautaire <em>si applicable</em></span><input value={value.vatNumber} onChange={(e) => update("vatNumber", e.target.value)} placeholder="Ex. FR…" /></label>
        <label>
          <span>Directeur de la publication</span>
          <input value={value.publicationDirector} onChange={(e) => update("publicationDirector", e.target.value)} placeholder={value.publisherType === "individual" ? effectiveName || "Prénom Nom" : "Nom du représentant légal"} />
          {value.publisherType === "individual" && !value.publicationDirector && effectiveDirector ? <small>AJG utilisera automatiquement « {effectiveDirector} ».</small> : null}
        </label>
      </div>

      <label className="compliance-regulated">
        <input type="checkbox" checked={value.regulatedActivity} onChange={(e) => update("regulatedActivity", e.target.checked)} />
        <span><b>Mon activité est réglementée ou soumise à autorisation</b><small>Activez si votre profession impose un titre, un ordre, un organisme professionnel, une autorisation ou des règles professionnelles spécifiques.</small></span>
      </label>

      {value.regulatedActivity ? (
        <div className="compliance-regulated-fields">
          <div className="compliance-grid">
            <label><span>Titre professionnel</span><input value={value.professionalTitle} onChange={(e) => update("professionalTitle", e.target.value)} placeholder="Titre professionnel exact" /></label>
            <label><span>Ordre / organisme professionnel</span><input value={value.professionalBody} onChange={(e) => update("professionalBody", e.target.value)} placeholder="Nom de l’ordre ou organisme" /></label>
          </div>
          <label className="compliance-full"><span>Autorité ayant délivré l’autorisation <em>si applicable</em></span><input value={value.authorizationAuthority} onChange={(e) => update("authorizationAuthority", e.target.value)} placeholder="Nom et adresse de l’autorité" /></label>
          <label className="compliance-full"><span>Règles professionnelles applicables</span><textarea rows={3} value={value.professionalRules} onChange={(e) => update("professionalRules", e.target.value)} placeholder="Référence ou lien vers les règles professionnelles applicables" /></label>
        </div>
      ) : null}

      <div className="compliance-divider" />

      <div className="compliance-grid">
        <label>
          <span>Contact pour les droits RGPD</span>
          <input type="email" value={value.privacyEmail} onChange={(e) => update("privacyEmail", e.target.value)} placeholder={value.email || "privacy@exemple.fr"} />
          {!value.privacyEmail && effectivePrivacy ? <small>AJG utilisera l’e-mail professionnel ci-dessus.</small> : null}
        </label>
        <label><span>DPO / Délégué à la protection des données <em>si désigné</em></span><input value={value.dpoContact} onChange={(e) => update("dpoContact", e.target.value)} placeholder="Nom ou e-mail du DPO" /></label>
      </div>

      <label className="compliance-full">
        <span>Mention légale complémentaire <em>facultatif</em></span>
        <textarea rows={3} value={value.additionalLegalNote} onChange={(e) => update("additionalLegalNote", e.target.value)} placeholder="Ajoutez ici une obligation propre à votre activité si nécessaire." />
      </label>

      <div className="privacy-by-default-note">
        <b>Protection des données par défaut</b>
        <p>Les sites AJG n’activent pas de publicité ni de mesure d’audience marketing par défaut. Les vidéos YouTube sont chargées seulement après action du visiteur. Les liens Calendly, Instagram, Facebook ou autres services externes ouvrent ces services tiers sans stocker leurs données dans AJG.</p>
      </div>

      {affiliation === "mwr" ? (
        <div className="compliance-mwr-note">
          <b>Profil MWR Life</b>
          <p>Ces informations légales complètent la mention d’indépendance MWR Life ; elles ne la remplacent pas.</p>
        </div>
      ) : null}

      <label className={`compliance-confirm ${value.confirmedAccuracy ? "confirmed" : ""}`}>
        <input type="checkbox" checked={value.confirmedAccuracy} onChange={(e) => update("confirmedAccuracy", e.target.checked)} />
        <span><b>Je confirme que ces informations correspondent à ma situation actuelle</b><small>AJG peut structurer et afficher ces informations, mais ne peut pas vérifier votre statut juridique, vos numéros ou vos obligations professionnelles à votre place.</small></span>
      </label>
    </div>
  );
}
