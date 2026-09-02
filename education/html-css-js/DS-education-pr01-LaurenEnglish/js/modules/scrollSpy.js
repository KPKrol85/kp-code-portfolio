export const initScrollSpy = () => {
  const links = Array.from(document.querySelectorAll(".nav__link"));
  if (!links.length) return;

  const normalizePathname = (pathname) => {
    const htmlPathname = pathname === "/" ? "/index.html" : pathname;
    return htmlPathname.endsWith(".html")
      ? htmlPathname.slice(0, -5)
      : htmlPathname;
  };
  const currentPathname = normalizePathname(window.location.pathname);
  const sectionLinks = links.flatMap((link) => {
    const href = link.getAttribute("href");
    if (!href) return [];

    const targetUrl = new URL(href, window.location.href);
    if (
      targetUrl.origin !== window.location.origin ||
      normalizePathname(targetUrl.pathname) !== currentPathname ||
      !targetUrl.hash
    ) {
      return [];
    }

    const section = document.getElementById(
      decodeURIComponent(targetUrl.hash.slice(1)),
    );
    return section ? [{ link, section }] : [];
  });

  if (!sectionLinks.length) return;
  if (typeof window.IntersectionObserver !== "function") return;

  const linkBySection = new Map(
    sectionLinks.map(({ link, section }) => [section, link]),
  );

  const observer = new window.IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const activeLink = linkBySection.get(entry.target);
          links.forEach((link) => {
            link.classList.toggle("is-active", link === activeLink);
          });
        }
      });
    },
    { threshold: 0.5 },
  );

  sectionLinks.forEach(({ section }) => observer.observe(section));
};
