const path = require("path");

module.exports = {
  plugins: {
    "postcss-import": {
      /* css/style.css addresses its modules with root-relative URLs so the
         browser, the dev server and axe's CSSOM preloader all resolve them to
         the same /css/modules/* path. Those URLs are site-root relative, not
         file-system paths, so map the leading "/" onto the project root here.
         Every other specifier is returned untouched and still goes through
         postcss-import's own resolver. */
      resolve: (id) => (id.startsWith("/") ? path.join(__dirname, id) : id),
    },
    "postcss-preset-env": {
      stage: 3,
      features: {
        "nesting-rules": true,
        "color-mix": true,
      },
    },
    autoprefixer: {},
    cssnano: {
      preset: ["default", { discardComments: { removeAll: true } }],
    },
  },
};
