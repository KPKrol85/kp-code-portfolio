export function initScrollspy(config) {
  if (!config || !config.pageClass || !config.ids || !config.listSelector) return;
  var onPage = document.body && document.body.classList.contains(config.pageClass);
  if (!onPage) return;

  var links = Array.prototype.slice.call(document.querySelectorAll(config.listSelector));
  if (!links.length) return;

  var linkMap = Object.create(null);
  links.forEach(function (a) {
    var id = (a.getAttribute("href") || "").replace(/^#/, "");
    if (id) linkMap[id] = a;
  });

  function setActive(id) {
    links.forEach(function (a) {
      var match = (a.getAttribute("href") || "").replace(/^#/, "") === id;
      if (match) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "location");
      } else {
        a.classList.remove("is-active");
        a.removeAttribute("aria-current");
      }
    });
  }

  var listEl = links.length ? links[0].closest("ul") : null;
  if (listEl) {
    listEl.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = (a.getAttribute("href") || "").replace(/^#/, "");
      if (!id) return;
      setActive(id);
      if (typeof history !== "undefined" && typeof history.replaceState === "function") {
        history.replaceState(null, "", "#" + id);
      }
    });
  }

  setActive(config.ids[0]);

  window.addEventListener("hashchange", function () {
    var id = (location.hash || "").replace(/^#/, "");
    if (id && linkMap[id]) setActive(id);
  });

  var headerEl = document.querySelector(".site-header");
  var stickyEl = config.stickySelector ? document.querySelector(config.stickySelector) : null;
  var headerHeight = 64;
  var stickyHeight = 0;
  var observer = null;

  function updatePositions() {
    headerHeight = headerEl ? headerEl.offsetHeight : 64;
    stickyHeight = stickyEl ? stickyEl.offsetHeight : 0;
  }

  function getObserverOptions() {
    /* Read from the current runtime state so a rebuild picks up new geometry and viewport mode. */
    var isMobile = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 640px)").matches : false;
    var topRM = config.topPercent ? config.topPercent : -(headerHeight + stickyHeight + 10) + "px";
    var bottomRM = isMobile ? config.bottomPercentMobile || "-65%" : config.bottomPercent || "-55%";
    return { root: null, rootMargin: topRM + " 0px " + bottomRM + " 0px", threshold: 0 };
  }

  function observeSections() {
    /* One observer at a time: the previous one is dropped before the replacement starts observing. */
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute("id");
          if (id) setActive(id);
        }
      });
    }, getObserverOptions());
    config.ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  updatePositions();

  if (typeof IntersectionObserver === "function") {
    /*
     IntersectionObserver owns the active section during scrolling, so the configured root margins
     have a single meaning. The scroll-offset algorithm below is not registered on this path.
    */
    observeSections();
    window.addEventListener("resize", function () {
      updatePositions();
      observeSections();
    });
    return;
  }

  /* Fallback owner, reached only where IntersectionObserver is unavailable. */
  var hash = (location.hash || "").replace(/^#/, "");
  setActive(hash && linkMap[hash] ? hash : config.ids[0]);

  var ticking = false;

  function getActiveId() {
    var offset = window.scrollY + headerHeight + stickyHeight + 8;
    var current = config.ids[0];
    for (var i = 0; i < config.ids.length; i++) {
      var el = document.getElementById(config.ids[i]);
      if (!el) continue;
      if (el.getBoundingClientRect().top + window.scrollY <= offset) {
        current = config.ids[i];
      }
    }
    return current;
  }

  function updateActive() {
    setActive(getActiveId());
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateActive();
      ticking = false;
    });
  }

  setTimeout(updateActive, 0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    updatePositions();
    updateActive();
  });
}
