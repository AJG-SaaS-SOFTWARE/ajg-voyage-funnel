import { Fragment } from "react";
import type { SiteModuleKey, SiteModules } from "../lib/site-design";

export default function SiteModulesView({ modules, english = false }: { modules: SiteModules; english?: boolean }) {
  const gallery = modules.gallery.enabled ? modules.gallery.images.filter((image) => image.url) : [];
  const faq = modules.faq.enabled ? modules.faq.items.filter((item) => item.question.trim() && item.answer.trim()) : [];
  const testimonials = modules.testimonials.enabled ? modules.testimonials.items.filter((item) => item.quote.trim() && item.author.trim()) : [];
  const email = modules.contact.enabled && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modules.contact.email.trim()) ? modules.contact.email.trim() : "";
  const figures = modules.figures.enabled ? modules.figures.items.filter((item) => item.value.trim() && item.label.trim()) : [];
  const benefits = modules.benefits.enabled ? modules.benefits.items.filter((item) => item.title.trim() && item.text.trim()) : [];
  const videoUrl = modules.video.enabled ? modules.video.url : "";
  const videoId = (() => {
    try {
      const url = new URL(videoUrl);
      if (url.protocol !== "https:") return "";
      if (url.hostname === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : "";
      if (["youtube.com", "www.youtube.com"].includes(url.hostname)) {
        const id = url.searchParams.get("v") || url.pathname.match(/^\/embed\/([\w-]{11})$/)?.[1];
        return id && /^[\w-]{11}$/.test(id) ? id : "";
      }
    } catch {}
    return "";
  })();

  const renderModule = (key: SiteModuleKey) => {
    switch (key) {
      case "gallery":
        return gallery.length ? (
          <section className="site-module" id="voyages">
            <h2>{modules.gallery.title}</h2>
            <div className="module-gallery">
              {gallery.map((image, index) => (
                <figure key={`${image.url}-${index}`}>
                  <img src={image.url} alt={image.caption || `${english ? "Travel" : "Voyage"} ${index + 1}`} loading="lazy" />
                  {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null;
      case "faq":
        return faq.length ? (
          <section className="site-module" id="faq">
            <h2>{modules.faq.title}</h2>
            {faq.map((item, index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </section>
        ) : null;
      case "testimonials":
        return testimonials.length ? (
          <section className="site-module" id="temoignages">
            <h2>{modules.testimonials.title}</h2>
            <div className="module-testimonials">
              {testimonials.map((item, index) => <blockquote key={index}><p>“{item.quote}”</p><footer>{item.author}</footer></blockquote>)}
            </div>
          </section>
        ) : null;
      case "video":
        return videoId ? (
          <section className="site-module" id="video">
            <h2>{modules.video.title}</h2>
            <div className="module-video">
              <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={modules.video.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </section>
        ) : null;
      case "figures":
        return figures.length ? (
          <section className="site-module" id="chiffres">
            <h2>{modules.figures.title}</h2>
            <div className="module-testimonials">
              {figures.map((item, index) => <div className="module-figure" key={index}><strong>{item.value}</strong><p>{item.label}</p></div>)}
            </div>
          </section>
        ) : null;
      case "benefits":
        return benefits.length ? (
          <section className="site-module" id="avantages">
            <h2>{modules.benefits.title}</h2>
            <div className="module-testimonials">
              {benefits.map((item, index) => <article className="module-figure" key={index}><h3>{item.title}</h3><p>{item.text}</p></article>)}
            </div>
          </section>
        ) : null;
      case "contact":
        return email ? (
          <section className="site-module" id="contact">
            <h2>{modules.contact.title}</h2>
            <a className="button primary" href={`mailto:${email}`}>{english ? "Send an email" : "Envoyer un e-mail"}</a>
          </section>
        ) : null;
    }
  };

  return (
    <>
      {modules.order.map((key) => <Fragment key={key}>{renderModule(key)}</Fragment>)}
    </>
  );
}
