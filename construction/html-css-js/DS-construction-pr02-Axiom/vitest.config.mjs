import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The contact form and the lightbox are DOM components, so the focused
    // suite runs against jsdom instead of a real browser.
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        // js/components/forms.js takes its local (no-network) submission path
        // when location.hostname is localhost, so the URL is pinned here to
        // keep that branch deterministic.
        url: "http://localhost/",
      },
    },
    include: ["tests/**/*.test.js"],
  },
});
