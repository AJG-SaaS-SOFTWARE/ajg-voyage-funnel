(() => {
  const form = document.querySelector('#lead-form');
  if (!form) return;

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
      showError('interet_principal', 'Choisissez une réponse pour continuer.');
      return false;
    }
    if (index === 1 && !form.querySelector('[name="frequence_voyage"]:checked')) {
      showError('frequence_voyage', 'Choisissez une réponse pour continuer.');
      return false;
    }
    if (index === 2 && !form.querySelector('[name="objectif_activite"]:checked')) {
      showError('objectif_activite', 'Choisissez une réponse pour continuer.');
      return false;
    }
    if (index === 3) {
      const firstName = form.elements.prenom.value.trim();
      const lastName = form.elements.nom.value.trim();
      const email = form.elements.email.value.trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!firstName || !lastName || !emailOk) {
        showError('coordonnees', 'Renseignez votre prénom, votre nom et une adresse email valide.');
        return false;
      }
    }
    return true;
  }

  function render() {
    steps.forEach((step, idx) => step.classList.toggle('is-active', idx === current));
    const pct = Math.round(((current + 1) / steps.length) * 100);
    progress.style.width = `${pct}%`;
    stepLabel.textContent = `Étape ${current + 1} sur ${steps.length}`;
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
    submit.textContent = 'Envoi…';

    try {
      const formData = new FormData(form);
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      window.location.assign('/merci.html');
    } catch (error) {
      console.error('Form submission failed:', error);
      submit.disabled = false;
      submit.textContent = 'Recevoir la présentation →';
      showError(
        'coordonnees',
        'L’envoi a échoué. Vérifiez votre connexion puis réessayez.'
      );
    }
  });

  form.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener('change', clearErrors);
  });

  render();
})();
