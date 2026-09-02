const anchorHeadingSelector = ".section__title, .card__title, h1, h2, h3";
const isValidHash = (hash) => typeof hash === "string" && hash.length > 1;

const getAnchorHeading = (target) =>
  target.matches(anchorHeadingSelector)
    ? target
    : target.querySelector(anchorHeadingSelector);

export const initAnchorFocus = () => {
  if (!isValidHash(window.location.hash)) return;

  const targetId = decodeURIComponent(window.location.hash.slice(1));
  if (!targetId) return;

  const target = document.getElementById(targetId);
  if (!target) return;

  const heading = getAnchorHeading(target);
  if (!heading) return;

  requestAnimationFrame(() => {
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
    }
    heading.setAttribute("data-anchor-focus-target", "");
    heading.focus({ preventScroll: true });
  });
};
