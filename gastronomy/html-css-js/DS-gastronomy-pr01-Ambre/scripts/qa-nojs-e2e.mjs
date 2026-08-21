import fs from "fs";
import http from "http";
import path from "path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const host = "127.0.0.1";
const port = Number(process.env.QA_NOJS_PORT || 4175);
const reportsDir = path.resolve(rootDir, "reports", "nojs");

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
    server.listen(port, host, () => resolve(server));
  });
};

const ensureDir = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const sanitizeStepName = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const run = async () => {
  console.log("QA NO-JS E2E: starting static server...");
  const server = await createStaticServer();

  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ javaScriptEnabled: false });
    page = await context.newPage();

    const baseUrl = `http://${host}:${port}`;

    const runStep = async (stepName, callback) => {
      try {
        console.log(`QA NO-JS E2E: ${stepName}`);
        await callback();
      } catch (error) {
        ensureDir(reportsDir);
        const screenshotPath = path.join(reportsDir, `${sanitizeStepName(stepName)}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`QA NO-JS E2E: FAIL at step "${stepName}"`);
        console.error(`Page: ${page.url()}`);
        console.error(`Screenshot: ${path.relative(rootDir, screenshotPath)}`);
        console.error(errorMessage);
        process.exitCode = 1;
        throw error;
      }
    };

    await runStep("open home page", async () => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.getByRole("heading", { level: 1, name: "Sezonowe menu degustacyjne" }).waitFor();
    });

    await runStep("verify header navigation in no-js mode", async () => {
      const nav = page.locator('header nav[aria-label="Główna nawigacja"]');
      await nav.waitFor();
      await nav.getByRole("link", { name: "O nas" }).waitFor();
      await nav.getByRole("link", { name: "Menu" }).first().waitFor();
      await nav.getByRole("link", { name: "Galeria" }).first().waitFor();
      await nav.getByRole("link", { name: "Rezerwacja" }).waitFor();
    });

    await runStep("navigate through header link", async () => {
      await page.getByTestId("site-header-nav").getByRole("link", { name: "Rezerwacja" }).click();
      await page.waitForURL("**/index.html#rezerwacja", { timeout: 10000 });
      await page.getByRole("heading", { level: 2, name: "Rezerwacja" }).waitFor();
    });

    await runStep("open contact section and validate booking form", async () => {
      await page.goto(`${baseUrl}/index.html#rezerwacja`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.getByRole("heading", { level: 2, name: "Rezerwacja" }).waitFor();

      const form = page.locator("#booking-form");
      await form.waitFor();
      await form.locator('input[name="name"][required]').waitFor();
      await form.locator('input[name="phone"][required]').waitFor();
      await form.locator('input[name="date"][required]').waitFor();
      await form.locator('input[name="time"][required]').waitFor();
    });

    await runStep("validate footer legal links", async () => {
      const footer = page.locator("footer.site-footer");
      await footer.waitFor();

      const legalLinks = [
        {
          linkName: "Polityka prywatności",
          expectedPath: "/polityka-prywatnosci.html",
          expectedHeading: "Polityka prywatności"
        },
        {
          linkName: "Regulamin",
          expectedPath: "/regulamin.html",
          expectedHeading: "Regulamin serwisu"
        },
        {
          linkName: "Cookies",
          expectedPath: "/cookies.html",
          expectedHeading: "Polityka cookies"
        }
      ];

      for (const legalLink of legalLinks) {
        await page.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded", timeout: 15000 });
        const link = page.locator(".site-footer__legal").getByRole("link", { name: legalLink.linkName });
        await link.waitFor();
        await link.click();
        await page.waitForURL(`**${legalLink.expectedPath}`, { timeout: 10000 });
        await page.getByRole("heading", { level: 1, name: legalLink.expectedHeading }).waitFor();
      }
    });

    console.log("QA NO-JS E2E: PASS");
  } finally {
    if (page) {
      await page.close();
    }

    if (context) {
      await context.close();
    }

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
  console.error("QA NO-JS E2E: ERROR");
  console.error(message);
  process.exit(1);
});
