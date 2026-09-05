// Canonical SVG icon registry.
//
// The path data of every project icon lives here once. Pages reference an icon
// by its stable id (`icon-github`, `icon-facebook`, `icon-instagram`, `icon-x`)
// through `<use href="#icon-...">`, so no markup ever repeats a path.
//
// The shapes are the Font Awesome Free v7.3.1 brand glyphs reduced to the
// single `viewBox` and `d` this project needs; see THIRD-PARTY-NOTICES.md for
// the attribution and license.

const SVG_NS = "http://www.w3.org/2000/svg";

// The one host element of the document. Its presence is what makes a second
// initialization a no-op, so the sprite can never be inserted twice.
const SPRITE_ID = "axiom-icon-sprite";

// Every registered shape is authored on the same square canvas, so instances
// can declare it without looking the icon up.
const ICON_VIEW_BOX = "0 0 640 640";

// Stable icon id -> path data. Static, project-owned strings only: they are
// written into SVG attributes, never into markup.
const ICON_PATHS = {
  "icon-github":
    "M280.5 426.5C214.5 418.5 168 371 168 309.5C168 284.5 177 257.5 192 239.5C185.5 223 186.5 188 194 173.5C214 171 241 181.5 257 196C276 190 296 187 320.5 187C345 187 365 190 383 195.5C398.5 181.5 426 171 446 173.5C453 187 454 222 447.5 239C463.5 258 472 283.5 472 309.5C472 371 425.5 417.5 358.5 426C375.5 437 387 461 387 488.5L387 540.5C387 555.5 399.5 564 414.5 558C505 523.5 576 433 576 321C576 179.5 461 64 319.5 64C178 64 64 179.5 64 321C64 432 134.5 524 229.5 558.5C243 563.5 256 554.5 256 541L256 501C249 504 240 506 232 506C199 506 179.5 488 165.5 454.5C160 441 154 433 142.5 431.5C136.5 431 134.5 428.5 134.5 425.5C134.5 419.5 144.5 415 154.5 415C169 415 181.5 424 194.5 442.5C204.5 457 215 463.5 227.5 463.5C240 463.5 248 459 259.5 447.5C268 439 274.5 431.5 280.5 426.5z",
  "icon-facebook":
    "M576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 440 146.7 540.8 258.2 568.5L258.2 398.2L205.4 398.2L205.4 320L258.2 320L258.2 286.3C258.2 199.2 297.6 158.8 383.2 158.8C399.4 158.8 427.4 162 438.9 165.2L438.9 236C432.9 235.4 422.4 235 409.3 235C367.3 235 351.1 250.9 351.1 292.2L351.1 320L434.7 320L420.3 398.2L351 398.2L351 574.1C477.8 558.8 576 450.9 576 320z",
  "icon-instagram":
    "M320.3 205C256.8 204.8 205.2 256.2 205 319.7C204.8 383.2 256.2 434.8 319.7 435C383.2 435.2 434.8 383.8 435 320.3C435.2 256.8 383.8 205.2 320.3 205zM319.7 245.4C360.9 245.2 394.4 278.5 394.6 319.7C394.8 360.9 361.5 394.4 320.3 394.6C279.1 394.8 245.6 361.5 245.4 320.3C245.2 279.1 278.5 245.6 319.7 245.4zM413.1 200.3C413.1 185.5 425.1 173.5 439.9 173.5C454.7 173.5 466.7 185.5 466.7 200.3C466.7 215.1 454.7 227.1 439.9 227.1C425.1 227.1 413.1 215.1 413.1 200.3zM542.8 227.5C541.1 191.6 532.9 159.8 506.6 133.6C480.4 107.4 448.6 99.2 412.7 97.4C375.7 95.3 264.8 95.3 227.8 97.4C192 99.1 160.2 107.3 133.9 133.5C107.6 159.7 99.5 191.5 97.7 227.4C95.6 264.4 95.6 375.3 97.7 412.3C99.4 448.2 107.6 480 133.9 506.2C160.2 532.4 191.9 540.6 227.8 542.4C264.8 544.5 375.7 544.5 412.7 542.4C448.6 540.7 480.4 532.5 506.6 506.2C532.8 480 541 448.2 542.8 412.3C544.9 375.3 544.9 264.5 542.8 227.5zM495 452C487.2 471.6 472.1 486.7 452.4 494.6C422.9 506.3 352.9 503.6 320.3 503.6C287.7 503.6 217.6 506.2 188.2 494.6C168.6 486.8 153.5 471.7 145.6 452C133.9 422.5 136.6 352.5 136.6 319.9C136.6 287.3 134 217.2 145.6 187.8C153.4 168.2 168.5 153.1 188.2 145.2C217.7 133.5 287.7 136.2 320.3 136.2C352.9 136.2 423 133.6 452.4 145.2C472 153 487.1 168.1 495 187.8C506.7 217.3 504 287.3 504 319.9C504 352.5 506.7 422.6 495 452z",
  "icon-x": "M453.2 112L523.8 112L369.6 288.2L551 528L409 528L297.7 382.6L170.5 528L99.8 528L264.7 339.5L90.8 112L236.4 112L336.9 244.9L453.2 112zM428.4 485.8L467.5 485.8L215.1 152L173.1 152L428.4 485.8z",
};

const createSymbol = (id, pathData) => {
  const symbol = document.createElementNS(SVG_NS, "symbol");
  symbol.setAttribute("id", id);
  symbol.setAttribute("viewBox", ICON_VIEW_BOX);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "currentColor");
  symbol.appendChild(path);
  return symbol;
};

// Inserts the registry once per document, as the hidden sprite every
// `<use href="#icon-...">` instance resolves against. Idempotent and safe on
// every page: a document without icon instances simply carries unused symbols.
export const initIcons = () => {
  if (!document.body || document.getElementById(SPRITE_ID)) return;

  const sprite = document.createElementNS(SVG_NS, "svg");
  sprite.setAttribute("id", SPRITE_ID);
  sprite.setAttribute("class", "icon-sprite");
  sprite.setAttribute("aria-hidden", "true");
  sprite.setAttribute("focusable", "false");

  Object.keys(ICON_PATHS).forEach((id) => {
    sprite.appendChild(createSymbol(id, ICON_PATHS[id]));
  });

  document.body.appendChild(sprite);
};
