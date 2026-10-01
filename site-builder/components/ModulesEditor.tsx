"use client";

import type { ChangeEvent } from "react";
import ModuleDraftAssistant from "./ModuleDraftAssistant";
import type { SiteLanguage } from "../lib/site-config";
import type { SiteModuleKey, SiteModules } from "../lib/site-design";
import { useProductLocale } from "../lib/product-i18n";

type Props = {
  modules: SiteModules;
  onChange: (value: SiteModules) => void;
  onImage: (event: ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  language: SiteLanguage;
  affiliation: "mwr" | "independent";
  firstName: string;
  brandName: string;
  architectureMode: "single" | "multi";
  siteContext?: Record<string, string | undefined>;
};

export default function ModulesEditor({
  modules,
  onChange,
  onImage,
  uploading,
  language,
  affiliation,
  firstName,
  brandName,
  architectureMode,
  siteContext
}: Props) {
  const { tr } = useProductLocale();
  const moduleLabels: Record<SiteModuleKey, string> = {
    gallery: tr("Galerie / Voyages", "Gallery"),
    faq: "FAQ",
    testimonials: tr("Témoignages", "Testimonials"),
    video: tr("Vidéo", "Video"),
    figures: tr("Chiffres clés", "Key figures"),
    benefits: tr("Avantages", "Benefits"),
    contact: "Contact"
  };
  const moduleDescriptions: Record<SiteModuleKey, string> = {
    gallery: tr("Montrez des photos réelles avec une courte légende.", "Show real photos with a short caption."),
    faq: tr("Répondez aux questions qu’un visiteur peut se poser avant de vous contacter.", "Answer the questions visitors may have before contacting you."),
    testimonials: tr("Ajoutez uniquement des retours réels que vous êtes autorisé à publier.", "Add only real feedback you are authorized to publish."),
    video: tr("Intégrez une vidéo YouTube pour expliquer ou illustrer votre activité.", "Embed a YouTube video to explain or illustrate your activity."),
    figures: tr("Mettez en avant quelques données vérifiables et à jour.", "Highlight a few verifiable, up-to-date figures."),
    benefits: tr("Expliquez concrètement ce que votre approche apporte au visiteur.", "Explain the concrete value your approach brings to visitors."),
    contact: tr("Permettez au visiteur de vous écrire directement par e-mail.", "Let visitors contact you directly by email.")
  };
  const change = <K extends keyof SiteModules>(key: K, value: SiteModules[K]) => onChange({ ...modules, [key]: value });
  const isEnabled = (key: SiteModuleKey) => modules[key].enabled;

  const setEnabled = (key: SiteModuleKey, enabled: boolean) => {
    change(key, { ...modules[key], enabled } as SiteModules[typeof key]);
  };

  const moveModule = (key: SiteModuleKey, direction: -1 | 1) => {
    const index = modules.order.indexOf(key);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= modules.order.length) return;
    const next = [...modules.order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    change("order", next);
  };

  const moduleHeader = (key: SiteModuleKey) => (
    <label className="module-toggle-header">
      <input
        className="visibility-option-input"
        type="checkbox"
        checked={isEnabled(key)}
        onChange={(event) => setEnabled(key, event.target.checked)}
      />
      <span className="visibility-switch" aria-hidden="true"><i /></span>
      <span className="module-toggle-copy">
        <b>{moduleLabels[key]}</b>
        <small>{moduleDescriptions[key]}</small>
      </span>
      <em>{isEnabled(key) ? tr("Activée", "Enabled") : tr("Désactivée", "Disabled")}</em>
    </label>
  );

  const assistantProps = {
    brief: modules.assistantBrief,
    language,
    affiliation,
    firstName,
    brandName,
    siteContext
  };

  return (
    <div className="modules-editor">
      <p>{tr("Activez uniquement les rubriques utiles. Une rubrique ne devient visible sur le site que lorsqu’elle est activée et contient du contenu exploitable.", "Enable only useful sections. A section becomes visible only when it is enabled and contains usable content.")}</p>

      <section className="module-assistant-brief">
        <div className="module-assistant-brief-heading">
          <span className="ai-field-spark">✦</span>
          <div>
            <b>{tr("Aidez AJG à préparer vos rubriques", "Help AJG prepare your sections")}</b>
            <p>{tr("Décrivez en quelques mots votre activité, votre business et surtout l’objectif de ce site. Cette note sert uniquement à préparer vos contenus et n’est jamais affichée sur le site.", "Briefly describe your activity, business and especially the goal of this website. This note is only used to prepare content and is never displayed publicly.")}</p>
          </div>
        </div>
        <textarea
          rows={4}
          maxLength={1000}
          value={modules.assistantBrief}
          onChange={(event) => change("assistantBrief", event.target.value)}
          placeholder={affiliation === "mwr"
            ? tr("Ex. Je suis ambassadeur indépendant MWR Life. Je veux présenter ma façon de voyager, répondre aux questions des personnes curieuses et les inviter à découvrir la plateforme sans pression.", "e.g. I am an independent MWR Life ambassador. I want to present how I travel, answer questions from curious visitors and invite them to discover the platform without pressure.")
            : tr("Ex. Je suis coach sportif indépendant. Je veux expliquer mon accompagnement, rassurer les nouveaux visiteurs et obtenir des prises de contact.", "e.g. I am an independent fitness coach. I want to explain my coaching, reassure new visitors and generate inquiries.")}
        />
        <small>{modules.assistantBrief.trim() ? tr("Contexte prêt ✓ — les assistants des rubriques peuvent l’utiliser.", "Context ready ✓ — section assistants can use it.") : tr("Quelques mots suffisent. Vous pourrez compléter ou modifier les propositions ensuite.", "A few words are enough. You can complete or edit the proposals afterwards.")}</small>
      </section>

      <section className="module-editor module-order-editor">
        <div>
          <b>{tr("Ordre des rubriques", "Section order")}</b>
          <p>{architectureMode === "multi"
            ? tr(
                "Cet ordre organise les rubriques de la page d’accueil. Les pages Galerie, FAQ, Contact et Services réutilisent ensuite les rubriques correspondantes définies ici.",
                "This order organizes homepage sections. Gallery, FAQ, Contact and Services pages then reuse the corresponding sections defined here."
              )
            : tr(
                "Sur votre site monopage, cet ordre devient l’ordre des rubriques dans l’aperçu et sur le site publié.",
                "On your single-page website, this becomes the section order in the preview and published website."
              )}</p>
        </div>
        <div className="module-order-list">
          {modules.order.map((key, index) => (
            <div className="module-order-row" key={key}>
              <span className="module-order-index">{index + 1}</span>
              <span><b>{moduleLabels[key]}</b><small>{isEnabled(key) ? tr("Activée", "Enabled") : tr("Désactivée", "Disabled")}</small></span>
              <div className="module-order-actions">
                <button type="button" className="secondary" aria-label={`${tr("Monter", "Move up")} ${moduleLabels[key]}`} disabled={index === 0} onClick={() => moveModule(key, -1)}>↑</button>
                <button type="button" className="secondary" aria-label={`${tr("Descendre", "Move down")} ${moduleLabels[key]}`} disabled={index === modules.order.length - 1} onClick={() => moveModule(key, 1)}>↓</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={`module-editor module-toggle-card ${modules.gallery.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("gallery")}
        {modules.gallery.enabled ? (
          <div className="module-fields">
            <label>{tr("Titre", "Title")}<input value={modules.gallery.title} maxLength={100} onChange={(e) => change("gallery", { ...modules.gallery, title: e.target.value })} /></label>
            <label>{tr("Ajouter une photo personnelle", "Add a personal photo")}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading || modules.gallery.images.length >= 12} onChange={onImage} /></label>
            {modules.gallery.images.map((image, index) => (
              <div className="module-row" key={index}>
                <img src={image.url} alt="" />
                <input aria-label={`${tr("Légende photo", "Photo caption")} ${index + 1}`} placeholder={tr("Légende descriptive recommandée", "Descriptive caption recommended")} value={image.caption} onChange={(e) => change("gallery", { ...modules.gallery, images: modules.gallery.images.map((item, i) => i === index ? { ...item, caption: e.target.value } : item) })} />
                <button type="button" onClick={() => change("gallery", { ...modules.gallery, images: modules.gallery.images.filter((_, i) => i !== index) })}>{tr("Retirer", "Remove")}</button>
              </div>
            ))}
            <small>{tr("Conseil : une bonne légende décrit simplement ce que l’on voit et pourquoi cette image compte pour vous.", "Tip: a good caption simply describes what is shown and why the image matters to you.")}</small>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.faq.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("faq")}
        {modules.faq.enabled ? (
          <div className="module-fields">
            <ModuleDraftAssistant
              moduleType="faq"
              {...assistantProps}
              currentValue={modules.faq}
              onApply={(draft: any) => change("faq", { ...modules.faq, title: draft.title, items: draft.items })}
            />
            <label>{tr("Titre", "Title")}<input value={modules.faq.title} onChange={(e) => change("faq", { ...modules.faq, title: e.target.value })} /></label>
            {modules.faq.items.map((item, index) => (
              <div className="module-item" key={index}>
                <input placeholder={tr("Question", "Question")} aria-label={`${tr("Question", "Question")} ${index + 1}`} value={item.question} onChange={(e) => change("faq", { ...modules.faq, items: modules.faq.items.map((q, i) => i === index ? { ...q, question: e.target.value } : q) })} />
                <textarea placeholder={tr("Réponse", "Answer")} aria-label={`${tr("Réponse", "Answer")} ${index + 1}`} value={item.answer} onChange={(e) => change("faq", { ...modules.faq, items: modules.faq.items.map((q, i) => i === index ? { ...q, answer: e.target.value } : q) })} />
                <button type="button" onClick={() => change("faq", { ...modules.faq, items: modules.faq.items.filter((_, i) => i !== index) })}>{tr("Retirer", "Remove")}</button>
              </div>
            ))}
            <button type="button" className="button secondary" disabled={modules.faq.items.length >= 12} onClick={() => change("faq", { ...modules.faq, items: [...modules.faq.items, { question: "", answer: "" }] })}>{tr("Ajouter une question manuellement", "Add a question manually")}</button>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.testimonials.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("testimonials")}
        {modules.testimonials.enabled ? (
          <div className="module-fields">
            <div className="module-safety-note"><b>{tr("Pas de faux témoignage", "No fake testimonials")}</b><p>{tr("AJG ne génère pas d’avis fictifs. Ajoutez uniquement un retour réellement reçu et autorisé à être publié.", "AJG does not generate fake reviews. Add only feedback you actually received and are authorized to publish.")}</p></div>
            <label>{tr("Titre", "Title")}<input value={modules.testimonials.title} onChange={(e) => change("testimonials", { ...modules.testimonials, title: e.target.value })} /></label>
            {modules.testimonials.items.map((item, index) => (
              <div className="module-item" key={index}>
                <textarea placeholder={tr("Témoignage obtenu avec accord de publication", "Testimonial received with permission to publish")} aria-label={`${tr("Témoignage", "Testimonial")} ${index + 1}`} value={item.quote} onChange={(e) => change("testimonials", { ...modules.testimonials, items: modules.testimonials.items.map((q, i) => i === index ? { ...q, quote: e.target.value } : q) })} />
                <input placeholder={tr("Prénom ou attribution autorisée", "First name or authorized attribution")} aria-label={`${tr("Auteur", "Author")} ${index + 1}`} value={item.author} onChange={(e) => change("testimonials", { ...modules.testimonials, items: modules.testimonials.items.map((q, i) => i === index ? { ...q, author: e.target.value } : q) })} />
                <button type="button" onClick={() => change("testimonials", { ...modules.testimonials, items: modules.testimonials.items.filter((_, i) => i !== index) })}>{tr("Retirer", "Remove")}</button>
              </div>
            ))}
            <button type="button" className="button secondary" disabled={modules.testimonials.items.length >= 12} onClick={() => change("testimonials", { ...modules.testimonials, items: [...modules.testimonials.items, { quote: "", author: "" }] })}>{tr("Ajouter un témoignage réel", "Add a real testimonial")}</button>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.contact.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("contact")}
        {modules.contact.enabled ? (
          <div className="module-fields">
            <label>{tr("Titre", "Title")}<input value={modules.contact.title} onChange={(e) => change("contact", { ...modules.contact, title: e.target.value })} /></label>
            <label>{tr("Adresse e-mail publique", "Public email address")}<input type="email" value={modules.contact.email} onChange={(e) => change("contact", { ...modules.contact, email: e.target.value })} /></label>
            <small>{tr("Le bouton ouvre la messagerie du visiteur ; votre adresse sera visible publiquement.", "The button opens the visitor’s email app; your address will be publicly visible.")}</small>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.video.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("video")}
        {modules.video.enabled ? (
          <div className="module-fields">
            <label>{tr("Titre", "Title")}<input value={modules.video.title} onChange={(e) => change("video", { ...modules.video, title: e.target.value })} /></label>
            <label>{tr("Lien YouTube", "YouTube link")}<input type="url" placeholder="https://www.youtube.com/watch?v=…" value={modules.video.url} onChange={(e) => change("video", { ...modules.video, url: e.target.value })} /></label>
            <small>{tr("Collez simplement l’adresse YouTube complète ; AJG s’occupe de l’intégration sur le site.", "Paste the full YouTube address; AJG handles the website embed.")}</small>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.figures.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("figures")}
        {modules.figures.enabled ? (
          <div className="module-fields">
            <ModuleDraftAssistant
              moduleType="figures"
              {...assistantProps}
              currentValue={modules.figures}
              onApply={(draft: any) => change("figures", { ...modules.figures, title: draft.title, items: draft.items })}
            />
            <label>{tr("Titre", "Title")}<input value={modules.figures.title} onChange={(e) => change("figures", { ...modules.figures, title: e.target.value })} /></label>
            {modules.figures.items.map((item, index) => (
              <div className="module-item" key={index}>
                <input aria-label={`${tr("Valeur", "Value")} ${index + 1}`} placeholder={tr("Votre valeur réelle", "Your real value")} value={item.value} onChange={(e) => change("figures", { ...modules.figures, items: modules.figures.items.map((entry, i) => i === index ? { ...entry, value: e.target.value } : entry) })} />
                <input aria-label={`${tr("Libellé", "Label")} ${index + 1}`} placeholder={tr("Ce que ce chiffre représente", "What this figure represents")} value={item.label} onChange={(e) => change("figures", { ...modules.figures, items: modules.figures.items.map((entry, i) => i === index ? { ...entry, label: e.target.value } : entry) })} />
                <button type="button" onClick={() => change("figures", { ...modules.figures, items: modules.figures.items.filter((_, i) => i !== index) })}>{tr("Retirer", "Remove")}</button>
              </div>
            ))}
            <button type="button" className="button secondary" disabled={modules.figures.items.length >= 12} onClick={() => change("figures", { ...modules.figures, items: [...modules.figures.items, { value: "", label: "" }] })}>{tr("Ajouter un chiffre manuellement", "Add a figure manually")}</button>
            <small>{tr("AJG peut suggérer quoi mesurer, mais ne remplira jamais une valeur à votre place. Utilisez uniquement des chiffres vérifiables et à jour.", "AJG can suggest what to measure but never fills in a value for you. Use only verifiable, up-to-date figures.")}</small>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.benefits.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("benefits")}
        {modules.benefits.enabled ? (
          <div className="module-fields">
            <ModuleDraftAssistant
              moduleType="benefits"
              {...assistantProps}
              currentValue={modules.benefits}
              onApply={(draft: any) => change("benefits", { ...modules.benefits, title: draft.title, items: draft.items })}
            />
            <label>{tr("Titre", "Title")}<input value={modules.benefits.title} onChange={(e) => change("benefits", { ...modules.benefits, title: e.target.value })} /></label>
            {modules.benefits.items.map((item, index) => (
              <div className="module-item" key={index}>
                <input aria-label={`${tr("Avantage", "Benefit")} ${index + 1}`} placeholder={tr("Titre", "Title")} value={item.title} onChange={(e) => change("benefits", { ...modules.benefits, items: modules.benefits.items.map((entry, i) => i === index ? { ...entry, title: e.target.value } : entry) })} />
                <textarea aria-label={`${tr("Description avantage", "Benefit description")} ${index + 1}`} placeholder={tr("Description concrète", "Concrete description")} value={item.text} onChange={(e) => change("benefits", { ...modules.benefits, items: modules.benefits.items.map((entry, i) => i === index ? { ...entry, text: e.target.value } : entry) })} />
                <button type="button" onClick={() => change("benefits", { ...modules.benefits, items: modules.benefits.items.filter((_, i) => i !== index) })}>{tr("Retirer", "Remove")}</button>
              </div>
            ))}
            <button type="button" className="button secondary" disabled={modules.benefits.items.length >= 12} onClick={() => change("benefits", { ...modules.benefits, items: [...modules.benefits.items, { title: "", text: "" }] })}>{tr("Ajouter un avantage manuellement", "Add a benefit manually")}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
