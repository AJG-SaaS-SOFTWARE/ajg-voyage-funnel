"use client";

import type { ChangeEvent } from "react";
import ModuleDraftAssistant from "./ModuleDraftAssistant";
import type { SiteLanguage } from "../lib/site-config";
import type { SiteModuleKey, SiteModules } from "../lib/site-design";

type Props = {
  modules: SiteModules;
  onChange: (value: SiteModules) => void;
  onImage: (event: ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  language: SiteLanguage;
  affiliation: "mwr" | "independent";
  firstName: string;
  brandName: string;
  siteContext?: Record<string, string | undefined>;
};

const moduleLabels: Record<SiteModuleKey, string> = {
  gallery: "Galerie / Voyages",
  faq: "FAQ",
  testimonials: "Témoignages",
  video: "Vidéo",
  figures: "Chiffres clés",
  benefits: "Avantages",
  contact: "Contact"
};

const moduleDescriptions: Record<SiteModuleKey, string> = {
  gallery: "Montrez des photos réelles avec une courte légende.",
  faq: "Répondez aux questions qu’un visiteur peut se poser avant de vous contacter.",
  testimonials: "Ajoutez uniquement des retours réels que vous êtes autorisé à publier.",
  video: "Intégrez une vidéo YouTube pour expliquer ou illustrer votre activité.",
  figures: "Mettez en avant quelques données vérifiables et à jour.",
  benefits: "Expliquez concrètement ce que votre approche apporte au visiteur.",
  contact: "Permettez au visiteur de vous écrire directement par e-mail."
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
  siteContext
}: Props) {
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
      <em>{isEnabled(key) ? "Activée" : "Désactivée"}</em>
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
      <p>Activez uniquement les rubriques utiles. Une rubrique ne devient visible sur le site que lorsqu’elle est activée et contient du contenu exploitable.</p>

      <section className="module-assistant-brief">
        <div className="module-assistant-brief-heading">
          <span className="ai-field-spark">✦</span>
          <div>
            <b>Aidez AJG à préparer vos rubriques</b>
            <p>Décrivez en quelques mots votre activité, votre business et surtout l’objectif de ce site. Cette note sert uniquement à préparer vos contenus et n’est jamais affichée sur le site.</p>
          </div>
        </div>
        <textarea
          rows={4}
          maxLength={1000}
          value={modules.assistantBrief}
          onChange={(event) => change("assistantBrief", event.target.value)}
          placeholder={affiliation === "mwr"
            ? "Ex. Je suis ambassadeur indépendant MWR Life. Je veux présenter ma façon de voyager, répondre aux questions des personnes curieuses et les inviter à découvrir la plateforme sans pression."
            : "Ex. Je suis coach sportif indépendant. Je veux expliquer mon accompagnement, rassurer les nouveaux visiteurs et obtenir des prises de contact."}
        />
        <small>{modules.assistantBrief.trim() ? "Contexte prêt ✓ — les assistants des rubriques peuvent l’utiliser." : "Quelques mots suffisent. Vous pourrez compléter ou modifier les propositions ensuite."}</small>
      </section>

      <section className="module-editor module-order-editor">
        <div>
          <b>Ordre des rubriques</b>
          <p>Organisez les sections dans l’ordre où elles apparaîtront dans l’aperçu et sur le site publié.</p>
        </div>
        <div className="module-order-list">
          {modules.order.map((key, index) => (
            <div className="module-order-row" key={key}>
              <span className="module-order-index">{index + 1}</span>
              <span><b>{moduleLabels[key]}</b><small>{isEnabled(key) ? "Activée" : "Désactivée"}</small></span>
              <div className="module-order-actions">
                <button type="button" className="secondary" aria-label={`Monter ${moduleLabels[key]}`} disabled={index === 0} onClick={() => moveModule(key, -1)}>↑</button>
                <button type="button" className="secondary" aria-label={`Descendre ${moduleLabels[key]}`} disabled={index === modules.order.length - 1} onClick={() => moveModule(key, 1)}>↓</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={`module-editor module-toggle-card ${modules.gallery.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("gallery")}
        {modules.gallery.enabled ? (
          <div className="module-fields">
            <label>Titre<input value={modules.gallery.title} maxLength={100} onChange={(e) => change("gallery", { ...modules.gallery, title: e.target.value })} /></label>
            <label>Ajouter une photo personnelle<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading || modules.gallery.images.length >= 12} onChange={onImage} /></label>
            {modules.gallery.images.map((image, index) => (
              <div className="module-row" key={index}>
                <img src={image.url} alt="" />
                <input aria-label={`Légende photo ${index + 1}`} placeholder="Légende descriptive recommandée" value={image.caption} onChange={(e) => change("gallery", { ...modules.gallery, images: modules.gallery.images.map((item, i) => i === index ? { ...item, caption: e.target.value } : item) })} />
                <button type="button" onClick={() => change("gallery", { ...modules.gallery, images: modules.gallery.images.filter((_, i) => i !== index) })}>Retirer</button>
              </div>
            ))}
            <small>Conseil : une bonne légende décrit simplement ce que l’on voit et pourquoi cette image compte pour vous.</small>
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
            <label>Titre<input value={modules.faq.title} onChange={(e) => change("faq", { ...modules.faq, title: e.target.value })} /></label>
            {modules.faq.items.map((item, index) => (
              <div className="module-item" key={index}>
                <input placeholder="Question" aria-label={`Question ${index + 1}`} value={item.question} onChange={(e) => change("faq", { ...modules.faq, items: modules.faq.items.map((q, i) => i === index ? { ...q, question: e.target.value } : q) })} />
                <textarea placeholder="Réponse" aria-label={`Réponse ${index + 1}`} value={item.answer} onChange={(e) => change("faq", { ...modules.faq, items: modules.faq.items.map((q, i) => i === index ? { ...q, answer: e.target.value } : q) })} />
                <button type="button" onClick={() => change("faq", { ...modules.faq, items: modules.faq.items.filter((_, i) => i !== index) })}>Retirer</button>
              </div>
            ))}
            <button type="button" className="secondary" disabled={modules.faq.items.length >= 12} onClick={() => change("faq", { ...modules.faq, items: [...modules.faq.items, { question: "", answer: "" }] })}>Ajouter une question manuellement</button>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.testimonials.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("testimonials")}
        {modules.testimonials.enabled ? (
          <div className="module-fields">
            <div className="module-safety-note"><b>Pas de faux témoignage</b><p>AJG ne génère pas d’avis fictifs. Ajoutez uniquement un retour réellement reçu et autorisé à être publié.</p></div>
            <label>Titre<input value={modules.testimonials.title} onChange={(e) => change("testimonials", { ...modules.testimonials, title: e.target.value })} /></label>
            {modules.testimonials.items.map((item, index) => (
              <div className="module-item" key={index}>
                <textarea placeholder="Témoignage obtenu avec accord de publication" aria-label={`Témoignage ${index + 1}`} value={item.quote} onChange={(e) => change("testimonials", { ...modules.testimonials, items: modules.testimonials.items.map((q, i) => i === index ? { ...q, quote: e.target.value } : q) })} />
                <input placeholder="Prénom ou attribution autorisée" aria-label={`Auteur ${index + 1}`} value={item.author} onChange={(e) => change("testimonials", { ...modules.testimonials, items: modules.testimonials.items.map((q, i) => i === index ? { ...q, author: e.target.value } : q) })} />
                <button type="button" onClick={() => change("testimonials", { ...modules.testimonials, items: modules.testimonials.items.filter((_, i) => i !== index) })}>Retirer</button>
              </div>
            ))}
            <button type="button" className="secondary" disabled={modules.testimonials.items.length >= 12} onClick={() => change("testimonials", { ...modules.testimonials, items: [...modules.testimonials.items, { quote: "", author: "" }] })}>Ajouter un témoignage réel</button>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.contact.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("contact")}
        {modules.contact.enabled ? (
          <div className="module-fields">
            <label>Titre<input value={modules.contact.title} onChange={(e) => change("contact", { ...modules.contact, title: e.target.value })} /></label>
            <label>Adresse e-mail publique<input type="email" value={modules.contact.email} onChange={(e) => change("contact", { ...modules.contact, email: e.target.value })} /></label>
            <small>Le bouton ouvre la messagerie du visiteur ; votre adresse sera visible publiquement.</small>
          </div>
        ) : null}
      </section>

      <section className={`module-editor module-toggle-card ${modules.video.enabled ? "is-active" : "is-inactive"}`}>
        {moduleHeader("video")}
        {modules.video.enabled ? (
          <div className="module-fields">
            <label>Titre<input value={modules.video.title} onChange={(e) => change("video", { ...modules.video, title: e.target.value })} /></label>
            <label>Lien YouTube<input type="url" placeholder="https://www.youtube.com/watch?v=…" value={modules.video.url} onChange={(e) => change("video", { ...modules.video, url: e.target.value })} /></label>
            <small>Collez simplement l’adresse YouTube complète ; AJG s’occupe de l’intégration sur le site.</small>
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
            <label>Titre<input value={modules.figures.title} onChange={(e) => change("figures", { ...modules.figures, title: e.target.value })} /></label>
            {modules.figures.items.map((item, index) => (
              <div className="module-item" key={index}>
                <input aria-label={`Valeur ${index + 1}`} placeholder="Votre valeur réelle" value={item.value} onChange={(e) => change("figures", { ...modules.figures, items: modules.figures.items.map((entry, i) => i === index ? { ...entry, value: e.target.value } : entry) })} />
                <input aria-label={`Libellé ${index + 1}`} placeholder="Ce que ce chiffre représente" value={item.label} onChange={(e) => change("figures", { ...modules.figures, items: modules.figures.items.map((entry, i) => i === index ? { ...entry, label: e.target.value } : entry) })} />
                <button type="button" onClick={() => change("figures", { ...modules.figures, items: modules.figures.items.filter((_, i) => i !== index) })}>Retirer</button>
              </div>
            ))}
            <button type="button" className="secondary" disabled={modules.figures.items.length >= 12} onClick={() => change("figures", { ...modules.figures, items: [...modules.figures.items, { value: "", label: "" }] })}>Ajouter un chiffre manuellement</button>
            <small>AJG peut suggérer quoi mesurer, mais ne remplira jamais une valeur à votre place. Utilisez uniquement des chiffres vérifiables et à jour.</small>
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
            <label>Titre<input value={modules.benefits.title} onChange={(e) => change("benefits", { ...modules.benefits, title: e.target.value })} /></label>
            {modules.benefits.items.map((item, index) => (
              <div className="module-item" key={index}>
                <input aria-label={`Avantage ${index + 1}`} placeholder="Titre" value={item.title} onChange={(e) => change("benefits", { ...modules.benefits, items: modules.benefits.items.map((entry, i) => i === index ? { ...entry, title: e.target.value } : entry) })} />
                <textarea aria-label={`Description avantage ${index + 1}`} placeholder="Description concrète" value={item.text} onChange={(e) => change("benefits", { ...modules.benefits, items: modules.benefits.items.map((entry, i) => i === index ? { ...entry, text: e.target.value } : entry) })} />
                <button type="button" onClick={() => change("benefits", { ...modules.benefits, items: modules.benefits.items.filter((_, i) => i !== index) })}>Retirer</button>
              </div>
            ))}
            <button type="button" className="secondary" disabled={modules.benefits.items.length >= 12} onClick={() => change("benefits", { ...modules.benefits, items: [...modules.benefits.items, { title: "", text: "" }] })}>Ajouter un avantage manuellement</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
