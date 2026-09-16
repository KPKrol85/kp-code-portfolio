import { initScrollspy } from "../core/scrollspy.js";

var FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#f3ede3"/><rect x="18" y="18" width="924" height="604" fill="none" stroke="#e2d6c3" stroke-width="2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b1e2f" font-family="sans-serif" font-size="24">Brak obrazu</text></svg>'
  );

export function initImageFallbacks(root) {
  var scope = root || document;
  var images = scope.querySelectorAll(".menu-card__figure img, .gallery__img");
  images.forEach(function (img) {
    if (img.dataset.fallbackBound) return;
    img.dataset.fallbackBound = "true";
    img.addEventListener("error", function () {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "true";
      img.classList.add("img-fallback");
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = FALLBACK_IMAGE;
    });
  });
}

var menuDataPromise = null;

function fetchMenuDataOnce() {
  if (menuDataPromise) return menuDataPromise;
  menuDataPromise = fetch("data/menu.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("menu.json load failed");
      return res.json();
    })
    .then(function (data) {
      return data && Array.isArray(data.items) ? data.items : [];
    })
    .catch(function () {
      return [];
    });
  return menuDataPromise;
}

var MENU_CARD_SIZES = "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw";

function buildMenuPictureMarkup(img, options) {
  if (!img) return "";
  options = options || {};
  var loading = options.loading || "lazy";
  var fetchpriority = options.fetchpriority ? ' fetchpriority="high"' : "";
  var sizes = img.sizes || MENU_CARD_SIZES;
  var variants = Array.isArray(img.variants) ? img.variants : [];
  var basePath = img.basePath || "";
  var category = img.category || "";
  var slug = img.slug || "";

  if (!variants.length) {
    return "";
  }

  var formatOrder = ["avif", "webp", "jpg", "png"];
  var availableFormats = [];
  variants.forEach(function (variant) {
    (variant.formats || []).forEach(function (fmt) {
      if (availableFormats.indexOf(fmt) === -1) availableFormats.push(fmt);
    });
  });
  availableFormats.sort(function (a, b) {
    return formatOrder.indexOf(a) - formatOrder.indexOf(b);
  });

  function buildSrcset(format) {
    return variants
      .filter(function (variant) {
        return Array.isArray(variant.formats) && variant.formats.indexOf(format) !== -1;
      })
      .map(function (variant) {
        return basePath + "/" + category + "/" + slug + "-" + variant.width + "x" + variant.height + "." + format + " " + variant.width + "w";
      })
      .join(", ");
  }

  var fallbackFormat = "jpg";
  if (availableFormats.indexOf(fallbackFormat) === -1) {
    fallbackFormat = availableFormats[0] || "jpg";
  }

  var fallbackVariants = variants.filter(function (variant) {
    return Array.isArray(variant.formats) && variant.formats.indexOf(fallbackFormat) !== -1;
  });
  var primaryVariant = (fallbackVariants.length ? fallbackVariants : variants).reduce(function (acc, variant) {
    return !acc || variant.width > acc.width ? variant : acc;
  }, null);

  var imgSrc = basePath + "/" + category + "/" + slug + "-" + primaryVariant.width + "x" + primaryVariant.height + "." + fallbackFormat;

  var sourcesMarkup = availableFormats
    .filter(function (format) {
      return format !== fallbackFormat;
    })
    .map(function (format) {
      var srcset = buildSrcset(format);
      if (!srcset) return "";
      return '<source type="image/' + format + '" srcset="' + srcset + '" sizes="' + sizes + '" />';
    })
    .join("");

  var imgSrcset = buildSrcset(fallbackFormat);

  return (
    "<picture>" +
    sourcesMarkup +
    '<img class="card__image" src="' +
    imgSrc +
    '" srcset="' +
    imgSrcset +
    '" sizes="' +
    sizes +
    '" alt="' +
    (img.alt || "") +
    '" loading="' +
    loading +
    '"' +
    fetchpriority +
    ' decoding="async" width="' +
    primaryVariant.width +
    '" height="' +
    primaryVariant.height +
    '" />' +
    "</picture>"
  );
}

function buildMenuCardMarkup(item, options) {
  if (!item) return "";
  options = options || {};
  var loading = options.loading || "lazy";
  var fetchpriority = options.fetchpriority;
  var img = item.image || {};
  var tags = Array.isArray(item.tags) && item.tags.length ? item.tags : [];
  var tagsMarkup = tags
    .map(function (tag) {
      return '<li class="menu-card__tag">' + tag + "</li>";
    })
    .join("");
  var figcaption = img.figcaption ? '<figcaption class="visually-hidden">' + img.figcaption + "</figcaption>" : "";
  var pictureMarkup = buildMenuPictureMarkup(img, { loading: loading, fetchpriority: fetchpriority });

  return (
    '<li class="card menu-card" data-reveal>' +
    "<article>" +
    '<figure class="menu-card__figure">' +
    pictureMarkup +
    figcaption +
    "</figure>" +
    '<div class="card__body">' +
    '<div class="menu-card__heading">' +
    '<h3 class="card__title">' +
    item.title +
    "</h3>" +
    '<span class="menu-card__price">' +
    item.price +
    "</span>" +
    "</div>" +
    '<p class="card__text">' +
    item.description +
    "</p>" +
    (tagsMarkup ? '<ul class="menu-card__tags">' + tagsMarkup + "</ul>" : "") +
    "</div>" +
    "</article>" +
    "</li>"
  );
}

export function renderFeaturedMenu() {
  var list = document.querySelector('[data-menu-featured="true"]');
  if (!list) return Promise.resolve(false);
  return fetchMenuDataOnce().then(function (items) {
    if (!items.length) return false;
    var preferred = ["przystawki", "dania-glowne", "desery"];
    var selection = [];
    preferred.forEach(function (cat) {
      var found = items.find(function (item) {
        return item.category === cat;
      });
      if (found) selection.push(found);
    });
    if (selection.length < 3) selection = items.slice(0, 3);
    var html = selection
      .map(function (item, idx) {
        return buildMenuCardMarkup(item, { loading: idx === 0 ? "eager" : "lazy", fetchpriority: idx === 0 });
      })
      .join("");
    if (!html) return false;
    list.innerHTML = html;
    initImageFallbacks(list);
    return true;
  });
}

export function renderMenuByCategory() {
  var lists = Array.prototype.slice.call(document.querySelectorAll("[data-menu-category]"));
  if (!lists.length) return Promise.resolve(false);
  return fetchMenuDataOnce().then(function (items) {
    if (!items.length) return false;
    var firstImage = true;
    lists.forEach(function (list) {
      var category = list.getAttribute("data-menu-category");
      if (!category) return;
      var subset = items.filter(function (item) {
        return item.category === category;
      });
      if (!subset.length) return;
      var html = subset
        .map(function (item) {
          var useEager = firstImage;
          firstImage = false;
          return buildMenuCardMarkup(item, { loading: useEager ? "eager" : "lazy", fetchpriority: useEager });
        })
        .join("");
      if (html) list.innerHTML = html;
      if (html) initImageFallbacks(list);
    });
    return true;
  });
}

export function initMenuPage() {
  var onMenuPage = document.body && document.body.classList.contains("page--menu");
  if (!onMenuPage) return;

  initScrollspy({
    pageClass: "page--menu",
    ids: ["przystawki", "dania-glowne", "zupy", "kuchnia-szefa", "desery", "drinki"],
    listSelector: '.menu-tabs__list a[href^="#"]',
    stickySelector: ".menu-navigation",
    topPercent: "-40%",
    bottomPercent: "-55%",
    bottomPercentMobile: "-65%",
  });

  function initMenuFilters() {
    var search = document.querySelector(".menu-filters__input");
    var buttonsWrap = document.querySelector(".menu-filters__group");
    if (!search || !buttonsWrap) return;

    var buttons = Array.prototype.slice.call(buttonsWrap.querySelectorAll(".menu-filters__btn[data-filter]"));
    var cards = Array.prototype.slice.call(document.querySelectorAll(".menu-card"));
    var emptyInfo = document.querySelector(".menu-filters__empty");

    function normalize(str) {
      return (str || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    cards.forEach(function (card) {
      var tags = Array.prototype.slice
        .call(card.querySelectorAll(".menu-card__tag"))
        .map(function (el) {
          return (el.textContent || "").trim();
        })
        .filter(Boolean);
      card.setAttribute("data-tags", tags.join(","));
    });

    var activeTag = "*";
    var term = "";

    function apply() {
      /*
       Filtering is computed client-side from normalized text + semantic tags.
       Both criteria are combined to keep search and category filters in sync.
      */
      var visibleCount = 0;
      var nTerm = normalize(term);
      cards.forEach(function (card) {
        var titleEl = card.querySelector(".card__title");
        var textEl = card.querySelector(".card__text");
        var hay = normalize((titleEl && titleEl.textContent) + " " + (textEl && textEl.textContent));
        var matchesTerm = !nTerm || hay.indexOf(nTerm) !== -1;
        var tags = (card.getAttribute("data-tags") || "").split(",").map(function (t) {
          return t.trim();
        });
        var matchesTag = activeTag === "*" || tags.indexOf(activeTag) !== -1;
        var show = matchesTerm && matchesTag;
        card.style.display = show ? "" : "none";
        if (show) visibleCount++;
      });
      if (emptyInfo) {
        emptyInfo.hidden = visibleCount !== 0;
        if (visibleCount === 0) emptyInfo.textContent = "Brak pozycji spełniających kryteria.";
      }
    }

    var debounceTimer = null;
    function debounced(fn, delay) {
      /* Shared debounce for input-driven filtering to reduce reflow on rapid typing. */
      return function () {
        var args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          fn.apply(null, args);
        }, delay);
      };
    }

    search.addEventListener(
      "input",
      debounced(function () {
        term = search.value || "";
        apply();
      }, 200)
    );

    buttonsWrap.addEventListener("click", function (e) {
      var btn = e.target.closest(".menu-filters__btn[data-filter]");
      if (!btn) return;
      buttons.forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      activeTag = btn.getAttribute("data-filter") || "*";
      apply();
    });

    apply();
  }

  function initPriceLabels() {
    var prices = Array.prototype.slice.call(document.querySelectorAll(".menu-card__price"));
    prices.forEach(function (el) {
      var raw = (el.textContent || "").trim();
      var m = raw.match(/[0-9]+(?:[\.,][0-9]+)?/);
      var val = m ? m[0] : raw;
      el.setAttribute("aria-label", val + " złotych");
    });
  }

  function enhanceFigureAlts() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".menu-card"));
    cards.forEach(function (card) {
      var fig = card.querySelector("figure");
      var img = fig ? fig.querySelector("img") : null;
      var titleEl = card.querySelector(".card__title");
      var descEl = card.querySelector(".card__text");
      if (!fig) return;
      var title = titleEl ? titleEl.textContent.trim() : "";
      var desc = descEl ? descEl.textContent.trim() : "";
      if (img && title) img.alt = title;
      var cap = fig.querySelector("figcaption");
      var full = title + (desc ? ". " + desc : "") + " — alergeny: wg obsługi.";
      if (cap) {
        cap.textContent = full;
        cap.classList.add("visually-hidden");
      } else {
        var newCap = document.createElement("figcaption");
        newCap.className = "visually-hidden";
        newCap.textContent = full;
        fig.appendChild(newCap);
      }
    });
  }

  function initAnchors() {
    function slugify(str) {
      return (str || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
    }
    function addAnchor(el) {
      if (!el) return;
      var id = el.getAttribute("id");
      if (!id) {
        id = slugify(el.textContent);
        if (id) el.setAttribute("id", id);
      }
      if (!id || el.querySelector(".anchor")) return;
      var a = document.createElement("a");
      a.className = "anchor";
      a.href = "#" + id;
      a.setAttribute("aria-label", "Kopiuj link do tego elementu");
      a.addEventListener("click", function (e) {
        e.preventDefault();
        /* Prefer Clipboard API, then fall back to execCommand for older environments. */
        var url = location.origin + location.pathname + "#" + id;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            a.setAttribute("aria-label", "Skopiowano link");
            setTimeout(function () {
              a.setAttribute("aria-label", "Kopiuj link do tego elementu");
            }, 1000);
          });
        } else {
          var input = document.createElement("input");
          input.value = url;
          document.body.appendChild(input);
          input.select();
          try {
            document.execCommand("copy");
          } catch (err) {}
          document.body.removeChild(input);
        }
        if (typeof history !== "undefined" && history.replaceState) history.replaceState(null, "", "#" + id);
      });
      el.appendChild(a);
    }
    document.querySelectorAll(".page--menu .menu-section__header h2").forEach(addAnchor);
    document.querySelectorAll(".page--menu .card__title").forEach(addAnchor);
  }

  renderMenuByCategory().then(function (rendered) {
    initMenuFilters();
    initPriceLabels();
    enhanceFigureAlts();
    initAnchors();
    if (rendered && typeof window.initReveal === "function") {
      window.initReveal();
    }
  });
}
