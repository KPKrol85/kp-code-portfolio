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

  var headerEl = document.querySelector(".site-header");
  var stickyEl = config.stickySelector ? document.querySelector(config.stickySelector) : null;
  var headerH = headerEl ? headerEl.offsetHeight : 64;
  var stickyH = stickyEl ? stickyEl.offsetHeight : 0;
  var isMobile = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 640px)").matches : false;
  var topRM = config.topPercent ? config.topPercent : -(headerH + stickyH + 10) + "px";
  var bottomRM = isMobile ? config.bottomPercentMobile || "-65%" : config.bottomPercent || "-55%";
  var options = { root: null, rootMargin: topRM + " 0px " + bottomRM + " 0px", threshold: 0.01 };

  if (typeof IntersectionObserver === "function") {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute("id");
          if (id) setActive(id);
        }
      });
    }, options);
    config.ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  } else {
    var hash = (location.hash || "").replace(/^#/, "");
    setActive(hash && linkMap[hash] ? hash : config.ids[0]);
  }

  window.addEventListener("hashchange", function () {
    var id = (location.hash || "").replace(/^#/, "");
    if (id && linkMap[id]) setActive(id);
  });

  var ticking = false;
  var headerHeight = headerH;
  var stickyHeight = stickyH;

  function updatePositions() {
    headerHeight = headerEl ? headerEl.offsetHeight : 64;
    stickyHeight = stickyEl ? stickyEl.offsetHeight : 0;
  }

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

  updatePositions();
  setTimeout(updateActive, 0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    updatePositions();
    updateActive();
  });
}
