/* Shared helpers for the functional browser scenarios.

   Every scenario runs in its own browser context created by withPage(), so no
   state — storage, focus, service worker, route handler — survives from one
   scenario to the next. Two project-specific setup decisions live here rather
   than in each scenario:

   - the first-visit project modal is pre-accepted through its own
     localStorage key, because it is a focus-trapping dialog that would block
     every interaction below it; production behaviour is untouched, the test
     simply starts as a returning visitor;
   - service workers are blocked, so sw.js cannot serve a scenario from a
     previous run's cache and the production-only precache 404s reserved for
     O-03 stay out of the run.

   withPage() also asserts, after the scenario body, that the page raised no
   uncaught error and issued no off-origin request — the second is what keeps
   the suite independent of Netlify and of network availability in general. */

const NAVIGATION_BREAKPOINT = 1024;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const PROJECT_BANNER_STORAGE_KEY = "project-banner-accepted";

/* forms.js starts its anti-spam timer when the form initialises and rejects
   anything submitted inside this window. Both are production constants; the
   suite waits them out rather than reaching into the module to shorten them. */
const ANTI_SPAM_WINDOW_MS = 2000;
const ANTI_SPAM_MARGIN_MS = 300;

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssertionError";
  }
}

function assert(condition, message) {
  if (!condition) throw new AssertionError(message);
}

function assertEqual(actual, expected, message) {
  if (!Object.is(actual, expected)) {
    throw new AssertionError(
      `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new AssertionError(`${message} — expected ${b}, got ${a}`);
  }
}

function assertIncludes(haystack, needle, message) {
  if (!String(haystack).includes(needle)) {
    throw new AssertionError(
      `${message} — expected ${JSON.stringify(String(haystack))} to include ${JSON.stringify(needle)}`,
    );
  }
}

async function withPage(browser, { baseURL, viewport }, run) {
  const context = await browser.newContext({
    baseURL,
    viewport,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });

  await context.addInitScript((key) => {
    try {
      window.localStorage.setItem(key, "true");
    } catch {
      /* about:blank has no accessible storage; the real page seeds it. */
    }
  }, PROJECT_BANNER_STORAGE_KEY);

  const page = await context.newPage();
  const pageErrors = [];
  const offOriginRequests = [];

  page.on("pageerror", (error) =>
    pageErrors.push(String(error?.message || error)),
  );
  page.on("request", (request) => {
    const url = request.url();
    if (!/^https?:/i.test(url)) return;
    if (url.startsWith(baseURL)) return;
    offOriginRequests.push(`${request.method()} ${url}`);
  });

  try {
    const result = await run({ context, page });

    assert(
      pageErrors.length === 0,
      `uncaught page error(s): ${pageErrors.join(" | ")}`,
    );
    assert(
      offOriginRequests.length === 0,
      `off-origin request(s) escaped the harness: ${offOriginRequests.join(" | ")}`,
    );

    return result;
  } finally {
    await context.close();
  }
}

/* Navigates and waits for script.js to have booted, so a scenario never races
   the module that owns the behaviour it asserts. */
async function openPage(page, route, { waitUntil = "load" } = {}) {
  const response = await page.goto(route, { waitUntil });

  assert(response, `no response for ${route}`);
  assertEqual(response.status(), 200, `${route} should be served`);

  await page.waitForFunction(() => Boolean(window.SC), null, { timeout: 5000 });

  return response;
}

async function hasClass(page, selector, className) {
  return page
    .locator(selector)
    .first()
    .evaluate((el, name) => el.classList.contains(name), className);
}

async function describeFocus(page, selector) {
  return page.evaluate((sel) => {
    const el = document.activeElement;
    if (!el || el === document.body) {
      return { matches: false, within: false, label: "document.body" };
    }
    const label =
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : "") +
      (el.classList.length ? `.${[...el.classList].join(".")}` : "") +
      (el.getAttribute("href") ? `[href="${el.getAttribute("href")}"]` : "");
    return {
      matches: el.matches(sel),
      within: Boolean(el.closest(sel)),
      label,
    };
  }, selector);
}

async function assertFocusOn(page, selector, context) {
  const focus = await describeFocus(page, selector);
  assert(
    focus.matches,
    `${context} — expected focus on "${selector}", found ${focus.label}`,
  );
}

async function assertFocusWithin(page, selector, context) {
  const focus = await describeFocus(page, selector);
  assert(
    focus.within,
    `${context} — expected focus inside "${selector}", found ${focus.label}`,
  );
}

/* Waits out the production anti-spam window, measured from a moment already
   known to be at or after the form's own start time. */
async function waitOutAntiSpamWindow(page, initialisedAt) {
  const remaining =
    ANTI_SPAM_WINDOW_MS + ANTI_SPAM_MARGIN_MS - (Date.now() - initialisedAt);
  if (remaining > 0) await page.waitForTimeout(remaining);
}

export {
  ANTI_SPAM_WINDOW_MS,
  AssertionError,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  NAVIGATION_BREAKPOINT,
  assert,
  assertDeepEqual,
  assertEqual,
  assertFocusOn,
  assertFocusWithin,
  assertIncludes,
  hasClass,
  openPage,
  waitOutAntiSpamWindow,
  withPage,
};
