(() => {
  const link = document.querySelector('#booking-link');
  if (!link) return;

  try {
    const raw = sessionStorage.getItem('ajg_booking_prefill');
    if (!raw) return;

    const data = JSON.parse(raw);
    const url = new URL(link.href);

    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');
    if (fullName) url.searchParams.set('name', fullName);
    if (data.email) url.searchParams.set('email', data.email);

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((key) => {
      if (data[key]) url.searchParams.set(key, data[key]);
    });

    link.href = url.toString();
  } catch (error) {
    console.warn('Calendly prefill unavailable:', error);
  }
})();
