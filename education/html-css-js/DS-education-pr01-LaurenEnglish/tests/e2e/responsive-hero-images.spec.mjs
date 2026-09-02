import { expect, test } from "@playwright/test";

import {
  CONTENT_IMAGE_ASSETS,
  MODERN_IMAGE_FORMATS,
  getFallbackImagePath,
  getImageCandidates,
  getImageSrcset,
} from "../../scripts/image-config.mjs";
import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";

const getAsset = (key) => {
  const asset = CONTENT_IMAGE_ASSETS.find((candidate) => candidate.key === key);
  if (!asset) throw new Error(`Missing image configuration for ${key}`);
  return asset;
};

const HERO_CASES = Object.freeze([
  {
    asset: getAsset("homepage-hero"),
    pagePath: "/index.html",
    selector: ".hero__image",
  },
  {
    asset: getAsset("contact-hero"),
    pagePath: "/kontakt.html",
    selector: ".hero__image--contact",
  },
]);

const VIEWPORT_CASES = Object.freeze([
  {
    deviceScaleFactor: 2,
    expectedCandidateWidth: 720,
    height: 844,
    maximumTransferBytes: 85_000,
    name: "large mobile",
    width: 390,
  },
  {
    deviceScaleFactor: 2,
    expectedCandidateWidth: 1080,
    height: 1024,
    maximumTransferBytes: 190_000,
    name: "tablet",
    width: 768,
  },
  {
    deviceScaleFactor: 1,
    expectedCandidateWidth: 540,
    height: 900,
    maximumTransferBytes: 50_000,
    name: "desktop",
    width: 1440,
  },
]);

for (const viewport of VIEWPORT_CASES) {
  test(`selects bounded AVIF hero candidates on ${viewport.name}`, async ({
    baseURL,
    browser,
  }) => {
    const context = await browser.newContext({
      deviceScaleFactor: viewport.deviceScaleFactor,
      serviceWorkers: "block",
      viewport: { height: viewport.height, width: viewport.width },
    });
    const page = await context.newPage();
    const diagnostics = collectRuntimeDiagnostics(page);

    try {
      for (const { asset, pagePath, selector } of HERO_CASES) {
        const expectedCandidate = getImageCandidates(asset, "avif").find(
          ({ width }) => width === viewport.expectedCandidateWidth,
        );
        expect(expectedCandidate).toBeDefined();

        await page.goto(new URL(pagePath, baseURL).toString(), {
          waitUntil: "networkidle",
        });
        const image = page.locator(selector);
        await expect(image).toBeVisible();
        await image.evaluate((element) => element.decode());
        const result = await image.evaluate((element) => {
          const pathFrom = (value) =>
            new URL(value, document.baseURI).pathname;
          const picture = element.closest("picture");
          const rect = element.getBoundingClientRect();
          const selectedPath = pathFrom(element.currentSrc);
          const resourceEntries = performance
            .getEntriesByType("resource")
            .filter((entry) => pathFrom(entry.name) === selectedPath);
          const selectedEntry = resourceEntries.at(-1);

          return {
            currentSrc: selectedPath,
            height: element.naturalHeight,
            loading: element.getAttribute("loading"),
            fetchpriority: element.getAttribute("fetchpriority"),
            renderedHeight: rect.height,
            renderedWidth: rect.width,
            sizes: element.getAttribute("sizes"),
            sources: Array.from(picture.querySelectorAll("source")).map(
              (source) => ({
                sizes: source.getAttribute("sizes"),
                srcset: source.getAttribute("srcset"),
                type: source.getAttribute("type"),
              }),
            ),
            src: pathFrom(element.getAttribute("src")),
            srcset: element.getAttribute("srcset"),
            transferSize: selectedEntry?.transferSize ?? 0,
            width: element.naturalWidth,
          };
        });

        expect(result.sources).toEqual(
          MODERN_IMAGE_FORMATS.map(({ extension, mimeType }) => ({
            sizes: asset.sizes,
            srcset: getImageSrcset(asset, extension),
            type: mimeType,
          })),
        );
        expect(result).toMatchObject({
          currentSrc: expectedCandidate.path,
          fetchpriority: "high",
          loading: "eager",
          sizes: asset.sizes,
          src: getFallbackImagePath(asset),
          srcset: getImageSrcset(asset, "jpg"),
        });
        expect(result.currentSrc).not.toContain("/assets/image-sources/");
        expect(result.renderedWidth * viewport.deviceScaleFactor).toBeLessThanOrEqual(
          expectedCandidate.width,
        );
        expect(result.renderedWidth / result.renderedHeight).toBeCloseTo(4 / 3, 3);
        expect(result.width / result.height).toBeCloseTo(4 / 3, 2);
        expect(result.width).toBeGreaterThanOrEqual(result.renderedWidth);
        expect(result.height).toBeGreaterThanOrEqual(result.renderedHeight);
        expect(result.transferSize).toBeGreaterThan(0);
        expect(result.transferSize).toBeLessThanOrEqual(viewport.maximumTransferBytes);
      }

      expectCleanDiagnostics(diagnostics);
    } finally {
      await context.close();
    }
  });
}
