const cssnanoPreset = [
  "default",
  {
    autoprefixer: false,
    discardComments: { removeAll: true },
    normalizeWhitespace: true,
    mergeLonghand: false,
  },
];

module.exports = {
  plugins: [
    require("postcss-import"),
    require("autoprefixer"),
    require("cssnano")({ preset: cssnanoPreset }),
  ],
};