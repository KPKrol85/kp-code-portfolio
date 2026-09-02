const REVEAL_THRESHOLD = 0.2;

const canMeetRevealThreshold = (item) => {
  const { height, width } = item.getBoundingClientRect();
  if (height <= 0 || width <= 0) return false;

  const maximumIntersectionRatio =
    Math.min(1, window.innerHeight / height) *
    Math.min(1, window.innerWidth / width);

  return maximumIntersectionRatio >= REVEAL_THRESHOLD;
};

export const initReveal = () => {
  const items = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!items.length) return;

  if (typeof window.matchMedia !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof window.IntersectionObserver !== "function") return;

  const revealableItems = items.filter(canMeetRevealThreshold);
  if (!revealableItems.length) return;

  let pendingCount = revealableItems.length;
  const observer = new window.IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          entry.target.classList.contains("is-reveal-pending")
        ) {
          entry.target.classList.add("is-visible");
          entry.target.classList.remove("is-reveal-pending");
          pendingCount -= 1;
          observer.unobserve(entry.target);

          if (pendingCount === 0) {
            observer.disconnect();
          }
        }
      });
    },
    { threshold: 0.2 },
  );

  try {
    revealableItems.forEach((item) => {
      item.classList.add("is-reveal-pending");
      observer.observe(item);
    });
  } catch (error) {
    observer.disconnect();
    revealableItems.forEach((item) =>
      item.classList.remove("is-reveal-pending", "is-visible"),
    );
    throw error;
  }
};
