
import assert from "node:assert/strict";
import fs from "fs";
import http from "http";
import path from "path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_A11Y_PORT || 4173);
const pages = [
  "/index.html",
  "/menu.html",
  "/galeria.html",
  "/cookies.html",
  "/polityka-prywatnosci.html",
  "/regulamin.html",
  "/offline.html",
  "/404.html"
];

const navigationTimeout = 15000;
const modalSelector = "#demo-legal-modal";
const acceptSelector = "[data-demo-legal-accept]";
const dialogSelector = "[role='dialog'][aria-modal='true']";
const mainSelector = "#main";
const acceptedStorageKey = "demoLegalAccepted";

// The negative control seeds an invalid image into the page body at runtime only,
// so the audited markup on disk keeps shipping without any planted violation.
const negativeControlPage = "/index.html";
const negativeControlId = "qa-a11y-negative-control";
const negativeControlRule = "image-alt";
const negativeControlSrc = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

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
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"]
]);

const createStaticServer = () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
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

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes.get(ext) || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve(server);
    });
  });
};

const formatNodeTargets = (nodes) => {
  const targets = [];
  for (const node of nodes) {
    const selector = Array.isArray(node.target) ? node.target.join(" | ") : "(unknown selector)";
    targets.push(selector || "(unknown selector)");
    if (targets.length >= 3) break;
  }
  return targets;
};

// The state matrix is derived from the shipped markup, never from whatever the
// browser happens to render, so a modal that silently stops opening fails the
// run instead of quietly downgrading a page to a single-state scan.
const readPagesShippingModal = () => {
  const shippingModal = new Set();

  for (const pagePath of pages) {
    const filePath = path.resolve(rootDir, pagePath.replace(/^\/+/, ""));
    assert.ok(fs.existsSync(filePath), `Audited page ${pagePath} must exist on disk`);
    if (fs.readFileSync(filePath, "utf8").includes('id="demo-legal-modal"')) {
      shippingModal.add(pagePath);
    }
  }

  assert.ok(
    shippingModal.has(negativeControlPage),
    `The negative control needs ${negativeControlPage} to ship the demo legal modal`
  );

  return shippingModal;
};

const readPageState = (page) =>
  page.evaluate(
    ({ modal: modalQuery, accept: acceptQuery, dialog: dialogQuery, main: mainQuery, storageKey }) => {
      const modal = document.querySelector(modalQuery);
      const main = document.querySelector(mainQuery);
      const background = Array.from(document.body.children).filter((element) => element !== modal);

      return {
        hasModal: Boolean(modal),
        modalHidden: modal ? modal.hasAttribute("hidden") : null,
        modalInert: modal ? modal.hasAttribute("inert") : null,
        modalAriaHidden: modal ? modal.getAttribute("aria-hidden") : null,
        hasDialogPanel: Boolean(modal?.querySelector(dialogQuery)),
        hasAcceptControl: Boolean(modal?.querySelector(acceptQuery)),
        backgroundCount: background.length,
        inertBackgroundCount: background.filter((element) => element.hasAttribute("inert")).length,
        hasMain: Boolean(main),
        mainIsInert: main ? Boolean(main.closest("[inert]")) : null,
        accepted: localStorage.getItem(storageKey)
      };
    },
    {
      modal: modalSelector,
      accept: acceptSelector,
      dialog: dialogSelector,
      main: mainSelector,
      storageKey: acceptedStorageKey
    }
  );

// Chromium's own accessibility tree is the arbiter of what assistive technology
// can reach, so each state is proven against it before Axe ever runs.
const readMainAxNodeCount = async (session) => {
  const { root } = await session.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: mainSelector });
  assert.ok(nodeId, `The main content must be resolvable through ${mainSelector}`);

  const { nodes } = await session.send("Accessibility.queryAXTree", { nodeId });
  return nodes.filter((node) => node.ignored !== true).length;
};

const assertModalOpenState = async (page, session, label) => {
  const state = await readPageState(page);

  assert.equal(state.hasModal, true, `${label}: the page must ship the demo legal modal`);
  assert.equal(state.accepted, null, `${label}: the scan must run on a real first visit, with no stored acceptance`);
  assert.equal(state.modalHidden, false, `${label}: the modal must not be hidden`);
  assert.equal(state.modalInert, false, `${label}: the modal itself must not be inert`);
  assert.equal(state.modalAriaHidden, "false", `${label}: the modal must be exposed as aria-hidden="false"`);
  assert.equal(state.hasDialogPanel, true, `${label}: the modal must expose a modal dialog panel`);
  assert.equal(state.hasAcceptControl, true, `${label}: the modal must expose its acceptance control`);
  assert.ok(state.backgroundCount > 0, `${label}: the page must render content behind the modal`);
  assert.equal(
    state.inertBackgroundCount,
    state.backgroundCount,
    `${label}: every element beside the modal must stay inert (${state.inertBackgroundCount}/${state.backgroundCount} inert)`
  );
  assert.equal(state.mainIsInert, true, `${label}: the main content must be inert behind the modal`);

  const exposedMainNodes = await readMainAxNodeCount(session);
  assert.equal(
    exposedMainNodes,
    0,
    `${label}: the inert background must stay out of the accessibility tree, found ${exposedMainNodes} exposed node(s)`
  );
};

const assertAcceptedPageState = async (page, session, label, shipsModal) => {
  const state = await readPageState(page);

  assert.equal(state.hasModal, shipsModal, `${label}: the modal presence must match the shipped markup`);

  if (shipsModal) {
    assert.equal(state.accepted, "true", `${label}: the scan must run after the real acceptance interaction`);
    assert.equal(state.modalHidden, true, `${label}: the accepted modal must be hidden`);
    assert.equal(state.modalInert, true, `${label}: the accepted modal must be inert`);
    assert.equal(state.modalAriaHidden, "true", `${label}: the accepted modal must be exposed as aria-hidden="true"`);
  }

  assert.equal(
    state.inertBackgroundCount,
    0,
    `${label}: no page content may stay inert, found ${state.inertBackgroundCount} inert element(s)`
  );
  assert.equal(state.hasMain, true, `${label}: the page must expose its main content`);
  assert.equal(state.mainIsInert, false, `${label}: the main content must no longer be inert`);

  const exposedMainNodes = await readMainAxNodeCount(session);
  assert.ok(
    exposedMainNodes > 0,
    `${label}: the main content must be exposed to the accessibility tree, found ${exposedMainNodes} node(s)`
  );
};

const openFirstVisit = async (page, pagePath, shipsModal) => {
  await page.goto(`http://${host}:${port}${pagePath}`, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
  if (shipsModal) {
    await page.locator(`${modalSelector}:not([hidden])`).waitFor({ timeout: navigationTimeout });
  }
  await page.waitForLoadState("load", { timeout: navigationTimeout });
};

// Acceptance goes through the shipped button, so the QA run reaches the
// full-page state the same way a visitor does.
const acceptDemoLegalModal = async (page) => {
  await page.locator(acceptSelector).click();
  await page.locator(`${modalSelector}[hidden]`).waitFor({ state: "attached", timeout: navigationTimeout });
};

const createAuditedContext = async (browser) => {
  const context = await browser.newContext({ bypassCSP: true, serviceWorkers: "block" });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("Accessibility.enable");
  return { context, page, session };
};

const countScannedNodes = (result) =>
  [...result.violations, ...result.passes, ...result.incomplete].reduce((total, entry) => total + entry.nodes.length, 0);

const scanState = async (page, pagePath, state) => {
  const result = await new AxeBuilder({ page }).analyze();
  const scannedNodes = countScannedNodes(result);
  const status = result.violations.length > 0 ? "FAIL" : "PASS";

  console.log(`${pagePath.replace(/^\//, "")} — ${state}: ${status} (${scannedNodes} node(s) scanned)`);
  return { result, scannedNodes };
};

const hasSeededViolation = (result) =>
  result.violations.some(
    (violation) =>
      violation.id === negativeControlRule &&
      violation.nodes.some((node) => String(node.target).includes(negativeControlId))
  );

// Proves the accepted/full-page scan can actually fail: a violation planted
// outside the modal is invisible while the modal owns the page and is caught
// once the background stops being inert.
const runNegativeControl = async (browser) => {
  const { context, page, session } = await createAuditedContext(browser);
  const label = negativeControlPage.replace(/^\//, "");

  try {
    await openFirstVisit(page, negativeControlPage, true);
    await assertModalOpenState(page, session, `negative control ${label} — modal-open`);

    const seeded = await page.evaluate(
      ({ main: mainQuery, modal: modalQuery, id, src }) => {
        const main = document.querySelector(mainQuery);
        if (!main) return { planted: false };

        const image = document.createElement("img");
        image.id = id;
        image.src = src;
        image.width = 24;
        image.height = 24;
        main.prepend(image);

        return {
          planted: true,
          hasAlt: image.hasAttribute("alt"),
          insideModal: Boolean(image.closest(modalQuery)),
          insideInert: Boolean(image.closest("[inert]"))
        };
      },
      { main: mainSelector, modal: modalSelector, id: negativeControlId, src: negativeControlSrc }
    );

    assert.equal(seeded.planted, true, "The negative control must be able to seed a violation into the main content");
    assert.equal(seeded.hasAlt, false, "The seeded image must ship without an alt attribute");
    assert.equal(seeded.insideModal, false, "The seeded violation must live outside the demo legal modal");
    assert.equal(seeded.insideInert, true, "The seeded violation must start inside the inert background");

    const modalOpenScan = await new AxeBuilder({ page }).analyze();
    assert.equal(
      hasSeededViolation(modalOpenScan),
      false,
      "The modal-open scan must not be able to see a violation outside the modal, which is the coverage gap this contract closes"
    );

    await acceptDemoLegalModal(page);
    await assertAcceptedPageState(page, session, `negative control ${label} — accepted-page`, true);

    const stillSeeded = await page.evaluate(
      ({ id, modal: modalQuery }) => {
        const image = document.getElementById(id);
        return {
          present: Boolean(image),
          insideModal: Boolean(image?.closest(modalQuery)),
          insideInert: Boolean(image?.closest("[inert]"))
        };
      },
      { id: negativeControlId, modal: modalSelector }
    );

    assert.deepEqual(
      stillSeeded,
      { present: true, insideModal: false, insideInert: false },
      "The seeded violation must survive acceptance outside the modal and outside any inert subtree"
    );

    const acceptedScan = await new AxeBuilder({ page }).analyze();
    assert.equal(
      hasSeededViolation(acceptedScan),
      true,
      `The accepted-page scan must report a [${negativeControlRule}] violation for the seeded node`
    );
    assert.ok(acceptedScan.violations.length > 0, "The seeded violation must fail the accepted-page result");

    console.log(
      `negative control ${label} — accepted-page: PASS (seeded [${negativeControlRule}] violation outside the modal detected; modal-open scan was blind to it)`
    );
  } finally {
    await context.close();
  }
};

const run = async () => {
  const pagesShippingModal = readPagesShippingModal();

  console.log("QA A11Y: starting static server...");
  const server = await createStaticServer();

  let browser;
  const allViolations = [];
  let scanCount = 0;

  try {
    console.log(
      `QA A11Y: scanning ${pages.length} page(s) in modal-open and accepted-page states at http://${host}:${port}`
    );
    browser = await chromium.launch({ headless: true });

    for (const pagePath of pages) {
      const shipsModal = pagesShippingModal.has(pagePath);
      const label = pagePath.replace(/^\//, "");
      const { context, page, session } = await createAuditedContext(browser);

      try {
        await openFirstVisit(page, pagePath, shipsModal);

        let modalOpenNodes = 0;

        if (shipsModal) {
          await assertModalOpenState(page, session, `${label} — modal-open`);
          const modalOpenScan = await scanState(page, pagePath, "modal-open");
          scanCount += 1;
          modalOpenNodes = modalOpenScan.scannedNodes;

          if (modalOpenScan.result.violations.length > 0) {
            allViolations.push({ pagePath, state: "modal-open", violations: modalOpenScan.result.violations });
          }

          await acceptDemoLegalModal(page);
        } else {
          console.log(`${label} — modal-open: SKIP (page ships no demo legal modal)`);
        }

        await assertAcceptedPageState(page, session, `${label} — accepted-page`, shipsModal);
        const acceptedScan = await scanState(page, pagePath, "accepted-page");
        scanCount += 1;

        if (acceptedScan.result.violations.length > 0) {
          allViolations.push({ pagePath, state: "accepted-page", violations: acceptedScan.result.violations });
        }

        if (shipsModal) {
          assert.ok(
            acceptedScan.scannedNodes > modalOpenNodes,
            `${label}: the accepted-page scan must expose more content to Axe than the modal-open scan (modal-open ${modalOpenNodes}, accepted-page ${acceptedScan.scannedNodes})`
          );
        }
      } finally {
        await context.close();
      }
    }

    await runNegativeControl(browser);

    if (allViolations.length > 0) {
      console.log("QA A11Y: FAIL\n");
      for (const entry of allViolations) {
        console.log(`Page: ${entry.pagePath} — ${entry.state}`);
        for (const violation of entry.violations) {
          const impact = violation.impact || "unknown";
          console.log(`  - [${violation.id}] impact=${impact}`);
          console.log(`    ${violation.description}`);
          const targets = formatNodeTargets(violation.nodes);
          console.log(`    nodes: ${targets.join(", ")}`);
        }
        console.log("");
      }

      const totalViolations = allViolations.reduce((sum, entry) => sum + entry.violations.length, 0);
      console.log(`Total page states with violations: ${allViolations.length}`);
      console.log(`Total violations: ${totalViolations}`);
      process.exitCode = 1;
      return;
    }

    console.log(`QA A11Y: PASS (${scanCount} scan(s) across ${pages.length} page(s))`);
  } finally {
    if (browser) {
      await browser.close();
    }

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error("QA A11Y: ERROR");
  console.error(message);
  process.exit(1);
});
