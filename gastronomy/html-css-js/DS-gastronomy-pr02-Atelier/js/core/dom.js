export function q(selector) {
  return typeof selector === "string" ? document.querySelector(selector) : selector || null;
}
