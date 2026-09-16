export function initReveal() {
  var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (!nodes.length) return;

  var motionQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var prefersReduce = motionQuery ? motionQuery.matches : false;
  var hasObserver = typeof window.IntersectionObserver === "function";
  var observer = null;

  var show = function (el) {
    el.classList.add("is-visible");
  };
  var isInView = function (el) {
    var rect = el.getBoundingClientRect();
    var viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    return rect.top <= viewportH * 0.9 && rect.bottom >= 0;
  };

  nodes.forEach(function (el) {
    el.classList.add("reveal");
  });
  document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
    var groupItems = group.querySelectorAll("[data-reveal]");
    groupItems.forEach(function (el, index) {
      el.style.setProperty("--reveal-delay", (index * 80).toString() + "ms");
    });
  });

  if (!hasObserver || prefersReduce) {
    nodes.forEach(show);
    return;
  }

  observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
  );

  nodes.forEach(function (el) {
    if (isInView(el)) {
      show(el);
    } else {
      observer.observe(el);
    }
  });

  if (motionQuery) {
    var handleMotionChange = function (event) {
      if (!event.matches || !observer) return;
      observer.disconnect();
      nodes.forEach(show);
    };
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", handleMotionChange);
    } else if (typeof motionQuery.addListener === "function") {
      motionQuery.addListener(handleMotionChange);
    }
  }
}

if (typeof window !== "undefined") {
  window.initReveal = initReveal;
}
