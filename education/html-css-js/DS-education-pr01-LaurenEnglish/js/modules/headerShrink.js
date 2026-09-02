const SHRINK_THRESHOLD = 96;
const EXPAND_THRESHOLD = 48;

export const initHeaderShrink = () => {
  const header = document.querySelector(".header");
  if (!header) return;

  let scheduledFrame = null;

  const updateHeaderState = () => {
    scheduledFrame = null;

    const isScrolled = header.classList.contains("is-scrolled");
    const scrollPosition = Math.max(window.scrollY, 0);
    const shouldShrink = isScrolled
      ? scrollPosition > EXPAND_THRESHOLD
      : scrollPosition >= SHRINK_THRESHOLD;

    if (shouldShrink !== isScrolled) {
      header.classList.toggle("is-scrolled", shouldShrink);
    }
  };

  const scheduleHeaderUpdate = () => {
    if (scheduledFrame !== null) return;

    scheduledFrame = window.requestAnimationFrame(updateHeaderState);
  };

  scheduleHeaderUpdate();
  window.addEventListener("scroll", scheduleHeaderUpdate, { passive: true });
  window.addEventListener("resize", scheduleHeaderUpdate, { passive: true });
  window.addEventListener("pageshow", scheduleHeaderUpdate);
};
