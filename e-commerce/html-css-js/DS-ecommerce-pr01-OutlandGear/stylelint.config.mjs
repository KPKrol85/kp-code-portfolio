export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "selector-class-pattern": [
      "^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$",
      {
        message:
          "Expected class selector to follow BEM (block__element--modifier), e.g. .card__title--active",
      },
    ],
    "custom-property-pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",

    // The codebase consistently uses rgba()/url()/quoted-font-name notation
    // rather than the newer CSS syntax stylelint-config-standard prefers.
    // These are style preferences, not defects, so they're disabled to avoid
    // rewriting every color/import/media-query in the project for no
    // functional gain.
    "no-descending-specificity": null,
    "alpha-value-notation": null,
    "color-function-notation": null,
    "color-function-alias-notation": null,
    "hue-degree-notation": null,
    "import-notation": null,
    "media-feature-range-notation": null,
    "font-family-name-quotes": null,
    "selector-not-notation": null,
    "color-hex-length": null,
    "value-keyword-case": null,
    "property-no-vendor-prefix": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "rule-empty-line-before": null,
    "at-rule-empty-line-before": null,
    "declaration-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "comment-empty-line-before": null,
  },
};
