(() => {
  const button = document.getElementById('booking-placeholder');
  const toast = document.getElementById('toast');
  if (!button || !toast) return;
  button.addEventListener('click', () => {
    toast.textContent = 'Le calendrier sera connecté à votre lien Cal.com avant publication.';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  });
})();
