(() => {
  const preferenceKey = 'ajg_language_preference';
  const currentLanguage = document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'fr';
  const path = window.location.pathname;
  const isFrenchHome = path === '/' || path === '/index.html';
  const isEnglishHome = path === '/en/' || path === '/en/index.html';
  const isHome = isFrenchHome || isEnglishHome;

  const readPreference = () => {
    try {
      const value = window.localStorage.getItem(preferenceKey);
      return value === 'fr' || value === 'en' ? value : null;
    } catch (_) {
      return null;
    }
  };

  const savePreference = (language) => {
    try {
      window.localStorage.setItem(preferenceKey, language);
    } catch (_) {}
  };

  const browserLanguage = () => {
    const primary = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return primary.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  };

  const redirectTo = (language) => {
    const targetPath = language === 'fr' ? '/' : '/en/';
    const target = new URL(targetPath, window.location.origin);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.toString());
  };

  if (isHome) {
    const preference = readPreference();

    if (preference && preference !== currentLanguage) {
      redirectTo(preference);
      return;
    }

    // On a first visit through the main URL, French browsers stay on FR.
    // Every other browser language is sent to the English version.
    if (!preference && isFrenchHome) {
      const detected = browserLanguage();
      if (detected === 'en') {
        redirectTo('en');
        return;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lang-switch]').forEach((link) => {
      link.addEventListener('click', () => {
        const targetLanguage = (link.getAttribute('lang') || '').toLowerCase();
        if (targetLanguage === 'fr' || targetLanguage === 'en') {
          savePreference(targetLanguage);
        }
      });
    });
  });
})();
