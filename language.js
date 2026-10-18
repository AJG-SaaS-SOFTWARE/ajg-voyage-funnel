(() => {
  const preferenceKey = 'ajg_language_preference';
  const supported = ['fr', 'en', 'es'];
  const normalize = (value) => {
    const primary = String(value || '').toLowerCase().split('-')[0];
    return supported.includes(primary) ? primary : null;
  };
  const currentLanguage = normalize(document.documentElement.lang) || 'fr';
  const path = window.location.pathname;
  const homes = { fr: ['/', '/index.html'], en: ['/en/', '/en/index.html'], es: ['/es/', '/es/index.html'] };
  const isHome = Object.values(homes).some((paths) => paths.includes(path));
  const readPreference = () => {
    try { return normalize(window.localStorage.getItem(preferenceKey)); }
    catch (_) { return null; }
  };
  const savePreference = (language) => {
    try { window.localStorage.setItem(preferenceKey, language); }
    catch (_) {}
  };
  const browserLanguage = () => {
    const preferences = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language || 'en'];
    // Respect the first browser language, falling back to English for unsupported locales.
    return normalize(preferences[0]) || 'en';
  };
  const redirectTo = (language) => {
    const targetPath = homes[language][0];
    const target = new URL(targetPath, window.location.origin);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.toString());
  };
  if (isHome && path === '/') {
    const selected = readPreference() || browserLanguage();
    if (selected !== currentLanguage) {
      redirectTo(selected);
      return;
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-lang-switch]').forEach((link) => {
      link.addEventListener('click', () => {
        const target = normalize(link.getAttribute('lang'));
        if (target) savePreference(target);
      });
    });
  });
})();
