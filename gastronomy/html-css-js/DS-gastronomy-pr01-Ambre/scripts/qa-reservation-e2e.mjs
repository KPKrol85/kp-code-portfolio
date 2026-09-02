import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_RESERVATION_PORT || 4176);
const baseUrl = `http://${host}:${port}`;
const successMessage = "Dziękujemy! Oddzwonimy, aby potwierdzić rezerwację.";
const failureMessage = "Nie udało się wysłać formularza. Sprawdź połączenie i spróbuj ponownie.";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"]
]);

const createStaticServer = () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", baseUrl);
    const requestedPath = decodeURIComponent(url.pathname);
    const normalizedPath = requestedPath === "/" ? "/index.html" : requestedPath;
    const relativePath = normalizedPath.replace(/^\/+/, "");
    const filePath = path.resolve(rootDir, relativePath);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
};

const openFormPage = async (browser, options = {}) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => {
    localStorage.setItem("demoLegalAccepted", "true");
  });

  if (options.disableFetch) {
    await context.addInitScript(() => {
      Object.defineProperty(window, "fetch", { configurable: true, value: undefined });
    });
  }

  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html#rezerwacja`, { waitUntil: "domcontentloaded" });
  await page.locator("#booking-form").waitFor();
  await page.waitForFunction(() => document.querySelector("#booking-form")?.noValidate === true);
  return { context, page };
};

const fillValidForm = async (page) => {
  await page.locator("#name").fill("Jan Kowalski");
  await page.locator("#phone").fill("123456789");
  await page.locator("#date").fill("2026-12-12");
  await page.locator("#time").fill("18:00");
  await page.locator("#guests").selectOption("2");
  await page.locator("#notes").fill("Stolik przy oknie");
  await page.locator("#consent").check();
};

const readFormState = (page) =>
  page.locator("#booking-form").evaluate((form) => ({
    name: form.elements.namedItem("name").value,
    phone: form.elements.namedItem("phone").value,
    date: form.elements.namedItem("date").value,
    time: form.elements.namedItem("time").value,
    guests: form.elements.namedItem("guests").value,
    notes: form.elements.namedItem("notes").value,
    consent: form.elements.namedItem("consent").checked
  }));

const assertFailureState = async (page, expectedState) => {
  await page.locator("#form-msg").filter({ hasText: failureMessage }).waitFor();
  assert.deepEqual(await readFormState(page), expectedState);
  await assertButtonUsable(page);
  assert.equal(await page.locator("#form-msg").textContent(), failureMessage);
  assert.notEqual(await page.locator("#form-msg").textContent(), successMessage);
};

const assertButtonUsable = async (page) => {
  const submitButton = page.locator('.site-button--form[type="submit"]');
  assert.equal(await submitButton.isEnabled(), true);
  assert.equal(await submitButton.getAttribute("aria-busy"), null);
  assert.equal(await submitButton.textContent(), "Wyślij rezerwację");
};

const runAcceptedResponseTest = async (browser) => {
  const { context, page } = await openFormPage(browser);
  let releaseResponse;
  const responseGate = new Promise((resolve) => {
    releaseResponse = resolve;
  });

  await context.route(`${baseUrl}/`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await responseGate;
    await route.fulfill({ status: 204, body: "" });
  });

  try {
    await fillValidForm(page);
    const submission = page.locator("#booking-form").evaluate((form) => form.requestSubmit());
    const submitButton = page.locator('.site-button--form[type="submit"]');
    await submitButton.waitFor({ state: "attached" });
    await page.waitForFunction(() => document.querySelector('.site-button--form[type="submit"]')?.disabled === true);
    assert.equal(await submitButton.getAttribute("aria-busy"), "true");
    assert.equal(await submitButton.textContent(), "Wysyłanie…");
    releaseResponse();
    await submission;

    await page.locator("#form-msg").filter({ hasText: successMessage }).waitFor();
    assert.deepEqual(await readFormState(page), {
      name: "",
      phone: "",
      date: "",
      time: "",
      guests: "",
      notes: "",
      consent: false
    });
    await assertButtonUsable(page);
  } finally {
    releaseResponse();
    await context.close();
  }
};

const runFailureTest = async (browser, kind) => {
  const { context, page } = await openFormPage(browser);

  await context.route(`${baseUrl}/`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    if (kind === "http") {
      await route.fulfill({ status: 503, body: "Service Unavailable" });
      return;
    }

    await route.abort("failed");
  });

  try {
    await fillValidForm(page);
    const expectedState = await readFormState(page);
    await page.locator("#booking-form").evaluate((form) => form.requestSubmit());
    await assertFailureState(page, expectedState);
  } finally {
    await context.close();
  }
};

const runNativeFallbackTest = async (browser) => {
  const { context, page } = await openFormPage(browser, { disableFetch: true });
  let interceptedPosts = 0;

  await context.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    interceptedPosts += 1;
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>Intercepted</title>"
    });
  });

  try {
    await fillValidForm(page);
    const [request] = await Promise.all([
      page.waitForRequest((candidate) => candidate.method() === "POST"),
      page.locator('.site-button--form[type="submit"]').click()
    ]);

    assert.equal(interceptedPosts, 1);
    assert.equal(new URL(request.url()).pathname, "/index.html");
    assert.match((await request.headerValue("content-type")) || "", /^application\/x-www-form-urlencoded/);
    assert.match(request.postData() || "", /form-name=reservation/);
    assert.match(request.postData() || "", /name=Jan\+Kowalski/);
  } finally {
    await context.close();
  }
};

const run = async () => {
  console.log("QA RESERVATION E2E: starting static server...");
  const server = await createStaticServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    console.log("QA RESERVATION E2E: accepted HTTP response");
    await runAcceptedResponseTest(browser);

    console.log("QA RESERVATION E2E: rejected HTTP response");
    await runFailureTest(browser, "http");

    console.log("QA RESERVATION E2E: network failure");
    await runFailureTest(browser, "network");

    console.log("QA RESERVATION E2E: native fallback without fetch");
    await runNativeFallbackTest(browser);

    console.log("QA RESERVATION E2E: PASS (4/4)");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
};

run().catch((error) => {
  console.error("QA RESERVATION E2E: ERROR");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
