module.exports = {
  extends: ["stylelint-config-recommended"],
  ignoreFiles: ["css/style.min.css"],
  rules: {
    "selector-class-pattern": [
      "^(?:(?:is|has)-[a-z0-9]+(?:-[a-z0-9]+)*|[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?)$",
      {
        resolveNestedSelectors: true,
        message: "Use BEM-style class names: block, block__element, block--modifier (kebab-case).",
      },
    ],
  },
};
