function setOfflineNotes(isOnline) {
  var autoNotes = document.querySelectorAll(".offline-note[data-auto]");
  if (isOnline) {
    autoNotes.forEach(function (note) {
      note.remove();
    });
    return;
  }
  var menuHero = document.querySelector(".page--menu .page-hero__content");
  if (menuHero && !menuHero.querySelector(".offline-note")) {
    var menuNote = document.createElement("p");
    menuNote.className = "offline-note";
    menuNote.dataset.auto = "true";
    menuNote.setAttribute("role", "status");
    menuNote.setAttribute("aria-live", "polite");
    menuNote.textContent = "Jesteś offline — wyświetlamy ostatnio zapisane menu. Część zdjęć może być niedostępna.";
    menuHero.appendChild(menuNote);
  }
  var galleryHero = document.querySelector(".page--gallery .page-hero__content");
  if (galleryHero && !galleryHero.querySelector(".offline-note")) {
    var galleryNote = document.createElement("p");
    galleryNote.className = "offline-note";
    galleryNote.dataset.auto = "true";
    galleryNote.setAttribute("role", "status");
    galleryNote.setAttribute("aria-live", "polite");
    galleryNote.textContent = "Jesteś offline — jeśli galeria nie była wcześniej odwiedzona, część zdjęć może się nie wczytać.";
    galleryHero.appendChild(galleryNote);
  }
}

export function initNetworkStatusBanner() {
  var banner = document.getElementById("network-status");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "network-status";
    banner.className = "net-status";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-atomic", "true");
    document.body.appendChild(banner);
  }

  var hideTimer = null;
  var lastState = null;

  function update(isOnline) {
    if (lastState === isOnline) return;
    lastState = isOnline;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (isOnline) {
      banner.textContent = "Połączenie przywrócone.";
      banner.classList.add("is-visible");
      banner.classList.remove("is-offline");
      hideTimer = setTimeout(function () {
        banner.classList.remove("is-visible");
      }, 4000);
    } else {
      banner.textContent = "Jesteś offline — część treści może być niedostępna.";
      banner.classList.add("is-visible");
      banner.classList.add("is-offline");
    }
    setOfflineNotes(isOnline);
  }

  var isOnline = typeof navigator !== "undefined" && "onLine" in navigator ? navigator.onLine : true;
  update(isOnline);
  window.addEventListener("online", function () {
    update(true);
  });
  window.addEventListener("offline", function () {
    update(false);
  });
}
