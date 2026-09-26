const SECTION_SELECTOR = 'main section[id]';
const ACTIVE_CLASS = 'is-active';

const updateActiveLink = (linksById, nextId) => {
  linksById.forEach((link, sectionId) => {
    const isActive = sectionId === nextId;
    link.classList.toggle(ACTIVE_CLASS, isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
};

const initSectionSpy = (header) => {
  const navLinks = Array.from(document.querySelectorAll('.nav__link[href^="#"]'));
  if (!navLinks.length) return;

  const linksById = new Map();
  navLinks.forEach((link) => {
    const sectionId = link.getAttribute('href')?.slice(1);
    if (sectionId) {
      linksById.set(sectionId, link);
    }
  });

  const trackedSections = Array.from(document.querySelectorAll(SECTION_SELECTOR)).filter((section) =>
    linksById.has(section.id)
  );

  if (!trackedSections.length) return;

  let activeSectionId = trackedSections[0].id;
  const updateFromViewport = () => {
    const headerOffset = header.offsetHeight + 24;
    const probeLine = window.scrollY + headerOffset;

    const current = trackedSections.find((section, index) => {
      const next = trackedSections[index + 1];
      if (!next) return probeLine >= section.offsetTop;
      return probeLine >= section.offsetTop && probeLine < next.offsetTop;
    });

    const nextId = current?.id ?? trackedSections[0].id;
    if (nextId !== activeSectionId) {
      activeSectionId = nextId;
      updateActiveLink(linksById, activeSectionId);
    }
  };

  updateActiveLink(linksById, activeSectionId);

  if (!('IntersectionObserver' in window)) {
    window.addEventListener('scroll', updateFromViewport, { passive: true });
    window.addEventListener('resize', updateFromViewport);
    updateFromViewport();
    return;
  }

  const visibleSections = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visibleSections.set(entry.target.id, entry);
      });

      const bestVisible = Array.from(visibleSections.values())
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => {
          if (b.intersectionRatio !== a.intersectionRatio) {
            return b.intersectionRatio - a.intersectionRatio;
          }

          return a.boundingClientRect.top - b.boundingClientRect.top;
        })[0];

      const nextId = bestVisible?.target.id;
      if (!nextId || nextId === activeSectionId) return;

      activeSectionId = nextId;
      updateActiveLink(linksById, activeSectionId);
    },
    {
      root: null,
      rootMargin: `-${header.offsetHeight + 20}px 0px -52% 0px`,
      threshold: [0.2, 0.4, 0.6, 0.8]
    }
  );

  trackedSections.forEach((section) => observer.observe(section));
};

const initHeaderMiniCta = () => {
  const miniCta = document.querySelector('[data-header-mini-cta]');
  const hero = document.querySelector('.hero');

  if (!miniCta || !hero) return;

  if (!('IntersectionObserver' in window)) {
    const onScroll = () => {
      miniCta.classList.toggle('is-visible', window.scrollY > hero.offsetHeight * 0.6);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return;
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      miniCta.classList.toggle('is-visible', !entry.isIntersecting);
    },
    { threshold: 0.15 }
  );

  observer.observe(hero);
};

export const initHeader = () => {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  const update = () => {
    if (window.scrollY > 20) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
  };

  update();
  window.addEventListener('scroll', update, { passive: true });

  initSectionSpy(header);
  initHeaderMiniCta();
};
