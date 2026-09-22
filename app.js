(() => {
  const form = document.querySelector('#lead-form');
  const lang = document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'fr';

  document.querySelectorAll('[data-lang-switch]').forEach((link) => {
    try {
      const url = new URL(link.getAttribute('href'), window.location.origin);
      if (window.location.search) url.search = window.location.search;
      link.href = url.toString();
    } catch (_) {}
  });

  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const slides = [...gallery.querySelectorAll('[data-gallery-slide]')];
    const dots = [...gallery.querySelectorAll('[data-gallery-dot]')];
    const prevButton = gallery.querySelector('[data-gallery-prev]');
    const nextButton = gallery.querySelector('[data-gallery-next]');
    let activeIndex = 0;
    let touchStartX = null;

    const showSlide = (index) => {
      if (!slides.length) return;
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle('is-active', slideIndex === activeIndex);
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === activeIndex;
        dot.classList.toggle('is-active', active);
        if (active) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    };

    prevButton?.addEventListener('click', () => showSlide(activeIndex - 1));
    nextButton?.addEventListener('click', () => showSlide(activeIndex + 1));
    dots.forEach((dot, dotIndex) => {
      dot.addEventListener('click', () => showSlide(dotIndex));
    });

    gallery.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') showSlide(activeIndex - 1);
      if (event.key === 'ArrowRight') showSlide(activeIndex + 1);
    });

    gallery.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    gallery.addEventListener('touchend', (event) => {
      if (touchStartX === null) return;
      const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
      const delta = touchEndX - touchStartX;
      if (Math.abs(delta) > 45) showSlide(activeIndex + (delta < 0 ? 1 : -1));
      touchStartX = null;
    }, { passive: true });

    showSlide(0);
  });

  if (!form) return;

  const copy = {
    fr: {
      choose: 'Choisissez une réponse pour continuer.',
      contact: 'Renseignez votre prénom, votre nom et une adresse email valide.',
      step: (current, total) => `Étape ${current} sur ${total}`,
      sending: 'Envoi…',
      submit: 'Recevoir la présentation →',
      submitError: 'L’envoi a échoué. Vérifiez votre connexion puis réessayez.'
    },
    en: {
      choose: 'Please choose an answer to continue.',
      contact: 'Please enter your first name, last name and a valid email address.',
      step: (current, total) => `Step ${current} of ${total}`,
      sending: 'Sending…',
      submit: 'Get the presentation →',
      submitError: 'Something went wrong. Please check your connection and try again.'
    }
  }[lang];

  const steps = [...form.querySelectorAll('.form-step')];
  const prev = document.querySelector('#prev-btn');
  const next = document.querySelector('#next-btn');
  const submit = document.querySelector('#submit-btn');
  const progress = document.querySelector('#progress-bar');
  const stepLabel = document.querySelector('#step-label');
  const percentLabel = document.querySelector('#progress-percent');
  let current = 0;

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const params = new URLSearchParams(window.location.search);
  utmKeys.forEach((key) => {
    const el = document.getElementById(key);
    if (el) el.value = params.get(key) || '';
  });

  const landing = document.getElementById('landing_url');
  if (landing) landing.value = window.location.href;
  const referrer = document.getElementById('referrer_url');
  if (referrer) referrer.value = document.referrer || '';
  const language = document.getElementById('language');
  if (language) language.value = lang;

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  }

  function showError(name, message) {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = message;
  }

  function validateStep(index) {
    clearErrors();

    if (index === 0 && !form.querySelector('[name="interet_principal"]:checked')) {
      showError('interet_principal', copy.choose);
      return false;
    }

    if (index === 1 && !form.querySelector('[name="frequence_voyage"]:checked')) {
      showError('frequence_voyage', copy.choose);
      return false;
    }

    if (index === 2 && !form.querySelector('[name="objectif_activite"]:checked')) {
      showError('objectif_activite', copy.choose);
      return false;
    }

    if (index === 3) {
      const firstName = form.elements.prenom.value.trim();
      const lastName = form.elements.nom.value.trim();
      const email = form.elements.email.value.trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!firstName || !lastName || !emailOk) {
        showError('coordonnees', copy.contact);
        return false;
      }
    }

    return true;
  }

  function render() {
    steps.forEach((step, idx) => step.classList.toggle('is-active', idx === current));
    const pct = Math.round(((current + 1) / steps.length) * 100);
    progress.style.width = `${pct}%`;
    stepLabel.textContent = copy.step(current + 1, steps.length);
    percentLabel.textContent = `${pct} %`;
    prev.classList.toggle('is-hidden', current === 0);
    next.classList.toggle('is-hidden', current === steps.length - 1);
    submit.classList.toggle('is-hidden', current !== steps.length - 1);
  }

  function updateScore() {
    const score = [...form.querySelectorAll('input[type="radio"]:checked')]
      .reduce((total, input) => total + Number(input.dataset.score || 0), 0);
    document.getElementById('lead_score').value = String(score);
  }

  next.addEventListener('click', () => {
    if (!validateStep(current)) return;
    updateScore();
    current = Math.min(current + 1, steps.length - 1);
    render();
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  prev.addEventListener('click', () => {
    clearErrors();
    current = Math.max(current - 1, 0);
    render();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateStep(3)) return;

    updateScore();
    submit.disabled = true;
    submit.textContent = copy.sending;

    try {
      const formData = new FormData(form);
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      window.location.assign(form.getAttribute('action') || (lang === 'en' ? '/en/thanks.html' : '/merci.html'));
    } catch (error) {
      console.error('Form submission failed:', error);
      submit.disabled = false;
      submit.textContent = copy.submit;
      showError('coordonnees', copy.submitError);
    }
  });

  form.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener('change', clearErrors);
  });

  render();
})();
