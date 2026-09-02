export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

export const on = (target, event, handler, options) => {
  if (!target) return;
  target.addEventListener(event, handler, options);
};
