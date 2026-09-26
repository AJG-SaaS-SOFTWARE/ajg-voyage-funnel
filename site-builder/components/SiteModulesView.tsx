import type { SiteModules } from "../lib/site-design";

export default function SiteModulesView({ modules }: { modules: SiteModules }) {
  const gallery = modules.gallery.enabled ? modules.gallery.images.filter((image) => image.url) : [];
  const faq = modules.faq.enabled ? modules.faq.items.filter((item) => item.question.trim() && item.answer.trim()) : [];
  const testimonials = modules.testimonials.enabled ? modules.testimonials.items.filter((item) => item.quote.trim() && item.author.trim()) : [];
  const email = modules.contact.enabled && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modules.contact.email.trim()) ? modules.contact.email.trim() : "";
  return <>
    {gallery.length ? <section className="site-module" id="voyages"><h2>{modules.gallery.title}</h2><div className="module-gallery">{gallery.map((image, index) => <figure key={`${image.url}-${index}`}><img src={image.url} alt={image.caption || `Voyage ${index + 1}`} loading="lazy" /><figcaption>{image.caption}</figcaption></figure>)}</div></section> : null}
    {faq.length ? <section className="site-module" id="faq"><h2>{modules.faq.title}</h2>{faq.map((item, index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section> : null}
    {testimonials.length ? <section className="site-module" id="temoignages"><h2>{modules.testimonials.title}</h2><div className="module-testimonials">{testimonials.map((item, index) => <blockquote key={index}><p>“{item.quote}”</p><footer>{item.author}</footer></blockquote>)}</div></section> : null}
    {email ? <section className="site-module" id="contact"><h2>{modules.contact.title}</h2><a className="button primary" href={`mailto:${email}`}>Envoyer un e-mail</a></section> : null}
  </>;
}
