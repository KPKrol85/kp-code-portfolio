export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) =>
  Array.from(scope.querySelectorAll(selector));

export const on = (element, event, handler, options) => {
  if (!element) return;
  element.addEventListener(event, handler, options);
};

export const delegate = (element, selector, event, handler) => {
  if (!element) return;
  element.addEventListener(event, (eventObject) => {
    const target = eventObject.target.closest(selector);
    if (target && element.contains(target)) {
      handler(eventObject, target);
    }
  });
};
