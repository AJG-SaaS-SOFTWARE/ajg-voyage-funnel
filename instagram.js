(() => {
  const preferenceKey = 'ajg_language_preference';
  const params = new URLSearchParams(window.location.search);

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

  const explicitLanguage = () => {
    const value = (params.get('lang') || '').toLowerCase();
    return value === 'fr' || value === 'en' ? value : null;
  };

  const browserLanguage = () => {
    const primary =
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      'en';
    return primary.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  };

  const explicit = explicitLanguage();
  if (explicit) {
    savePreference(explicit);
    params.delete('lang');
  }

  const language = explicit || readPreference() || browserLanguage();

  if (!params.has('utm_source')) params.set('utm_source', 'instagram');
  if (!params.has('utm_medium')) params.set('utm_medium', 'social');
  if (!params.has('utm_campaign')) params.set('utm_campaign', 'instagram_profile');
  if (!params.has('utm_content')) params.set('utm_content', 'bio');

  const target = new URL(language === 'fr' ? '/' : '/en/', window.location.origin);
  target.search = params.toString();
  window.location.replace(target.toString());
})();
