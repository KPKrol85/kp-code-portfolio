// js/sw-register.js
(() => {
  if (!("serviceWorker" in navigator)) return;

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  window.addEventListener("load", async () => {
    if (isLocal) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      } catch {}
      return;
    }

    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
})();
