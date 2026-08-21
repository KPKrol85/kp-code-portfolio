
(() => {
  let deferredEvt = null;

  const btn = document.querySelector('[data-install-pwa]');
  if (!btn) return;

  btn.hidden = true;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredEvt = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferredEvt) return;
    btn.disabled = true;
    try {
      deferredEvt.prompt();
      const choice = await deferredEvt.userChoice;
      btn.hidden = true;
      deferredEvt = null;
    } catch {
      btn.disabled = false;
    }
  });

  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    deferredEvt = null;
  });
})();
