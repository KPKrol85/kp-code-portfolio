import { expect, test } from "@playwright/test";

import {
  INDEXABLE_PAGES,
  SITE,
  UTILITY_PAGES,
  absoluteUrl,
} from "../../scripts/site-config.mjs";
import {
  collectRuntimeDiagnostics,
  expectCleanDiagnostics,
} from "./helpers/runtime.mjs";
import {
  DIST_ROOT,
  discoverViteRuntimePaths,
} from "../../scripts/build-service-worker.mjs";

const EXPECTED_SOCIAL_IMAGE_PATH = "/assets/og/og.png";

const expectSingleMeta = async (page, selector, expected) => {
  const locator = page.locator(selector);
  await expect(locator).toHaveCount(1);
  await expect(locator).toHaveAttribute("content", expected);
};

test.describe("SEO metadata and static routing", () => {
  let runtimePaths;

  test.beforeAll(async () => {
    runtimePaths = await discoverViteRuntimePaths(DIST_ROOT);
  });

  test("contact page and public CTA destinations match the approved contract", async ({
    page,
    request,
  }) => {
    const response = await request.get("/kontakt.html");
    expect(response.status()).toBe(200);

    await page.goto("/kontakt.html", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Porozmawiajmy o Twojej nauce angielskiego.",
      }),
    ).toBeVisible();
    const contactMethods = page.getByRole("region", {
      name: "Wybierz wygodny sposób kontaktu",
    });
    await expect(contactMethods).toBeVisible();
    await expect(
      contactMethods.getByRole("link", { name: "+48 533 537 091" }),
    ).toHaveAttribute("href", "tel:+48533537091");
    await expect(
      contactMethods.getByRole("link", { name: "kontakt@kp-code.pl" }),
    ).toHaveAttribute("href", "mailto:kontakt@kp-code.pl");
    await expect(contactMethods.locator("address")).toContainText(
      "ul. Marynarki Wojennej 12/31, 33-100 Tarnów, Polska",
    );
    await expect(
      page.locator('.nav__link[href="/kontakt.html"]'),
    ).toHaveAttribute("aria-current", "page");

    const form = page.locator("#formularz form");
    await expect(form).toHaveAttribute("method", "POST");
    await expect(form).toHaveAttribute("action", "/thank-you.html");
    await expect(form).toHaveAttribute("data-netlify", "true");
    await expect(form).toHaveAttribute("netlify-honeypot", "bot-field");
    for (const label of [
      "Imię i nazwisko (wymagane)",
      "Adres e-mail (wymagane)",
      "Numer telefonu (opcjonalnie)",
      "Temat zapytania (wymagane)",
      "Wiadomość (wymagane)",
    ]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(1);
    }
    await expect(
      page.locator('.nav__cta[href="/kontakt.html#formularz"]'),
    ).toHaveText("Napisz do mnie");
    await expect(
      page.locator('.header__cta[href="/kontakt.html#formularz"]'),
    ).toHaveText("Napisz do mnie");
    await expect(
      page.locator('footer a[href="/kontakt.html"]', { hasText: "Kontakt" }),
    ).toHaveCount(1);

    await page.goto("/index.html", { waitUntil: "networkidle" });
    const heroActions = page.locator(".hero__actions").first();
    await expect(
      heroActions.getByRole("link", { name: "Zobacz pakiety" }),
    ).toHaveAttribute("href", "/pakiety.html#pakiety");
    await expect(
      heroActions.getByRole("link", { name: "Zobacz materiały" }),
    ).toHaveAttribute("href", "#resources");
    const compactContact = page.locator("#contact");
    await expect(
      compactContact.getByRole("link", { name: "Napisz do mnie" }),
    ).toHaveAttribute("href", "/kontakt.html");
    await expect(
      compactContact.getByRole("link", { name: "Zadzwoń" }),
    ).toHaveAttribute("href", "tel:+48533537091");
  });

  test("known routes and required assets return 200 while unknown routes return 404", async ({
    request,
  }) => {
    expect(SITE.socialImage.path).toBe(EXPECTED_SOCIAL_IMAGE_PATH);

    for (const publicPage of INDEXABLE_PAGES) {
      const response = await request.get(publicPage.path, { maxRedirects: 0 });
      expect(response.status(), publicPage.path).toBe(200);
    }

    for (const utilityPage of UTILITY_PAGES) {
      const response = await request.get(utilityPage.runtimePath, {
        maxRedirects: 0,
      });
      expect(response.status(), utilityPage.runtimePath).toBe(200);
    }

    for (const asset of [...runtimePaths, EXPECTED_SOCIAL_IMAGE_PATH]) {
      const response = await request.get(asset, { maxRedirects: 0 });
      expect(response.status(), asset).toBe(200);
      if (asset === EXPECTED_SOCIAL_IMAGE_PATH) {
        expect(response.headers()["content-type"]).toContain("image/png");
        const image = await response.body();
        expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(image.readUInt32BE(16)).toBe(1200);
        expect(image.readUInt32BE(20)).toBe(630);
      }
    }

    for (const unknownPath of ["/nie-istnieje", "/missing/seo-route.html"]) {
      const response = await request.get(unknownPath, { maxRedirects: 0 });
      expect(response.status(), unknownPath).toBe(404);
      expect(response.url()).toContain(unknownPath);
      const body = await response.text();
      expect(body).not.toContain("Angielski, który daje spokój i wyniki");
    }
  });

  test("indexable pages expose synchronized runtime metadata and valid JSON-LD", async ({
    page,
    request,
  }) => {
    const diagnostics = collectRuntimeDiagnostics(page);

    for (const publicPage of INDEXABLE_PAGES) {
      const canonical = absoluteUrl(publicPage.path);
      const imageUrl = absoluteUrl(EXPECTED_SOCIAL_IMAGE_PATH);
      expect(imageUrl).toMatch(/^https:\/\//u);
      const response = await page.goto(publicPage.path, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), publicPage.path).toBe(200);
      await expect(page).toHaveTitle(publicPage.title);

      await expectSingleMeta(
        page,
        'meta[name="description"]',
        publicPage.description,
      );
      const canonicalLink = page.locator('link[rel="canonical"]');
      await expect(canonicalLink).toHaveCount(1);
      await expect(canonicalLink).toHaveAttribute("href", canonical);
      await expectSingleMeta(page, 'meta[property="og:url"]', canonical);
      await expectSingleMeta(
        page,
        'meta[property="og:title"]',
        publicPage.title,
      );
      await expectSingleMeta(
        page,
        'meta[property="og:description"]',
        publicPage.description,
      );
      await expectSingleMeta(page, 'meta[property="og:image"]', imageUrl);
      await expectSingleMeta(
        page,
        'meta[property="og:image:secure_url"]',
        imageUrl,
      );
      await expectSingleMeta(
        page,
        'meta[property="og:image:type"]',
        SITE.socialImage.type,
      );
      await expectSingleMeta(
        page,
        'meta[property="og:image:width"]',
        String(SITE.socialImage.width),
      );
      await expectSingleMeta(
        page,
        'meta[property="og:image:height"]',
        String(SITE.socialImage.height),
      );
      await expectSingleMeta(
        page,
        'meta[name="twitter:card"]',
        "summary_large_image",
      );
      await expectSingleMeta(page, 'meta[name="twitter:image"]', imageUrl);

      const jsonLd = page.locator('script[type="application/ld+json"]');
      await expect(jsonLd).toHaveCount(1);
      const structuredData = JSON.parse(await jsonLd.textContent());
      expect(structuredData["@type"]).toBe(publicPage.schemaType);
      expect(structuredData.url).toBe(canonical);
      expect(structuredData.name).toBe(
        publicPage.schemaType === "WebSite" ? SITE.name : publicPage.title,
      );
      expect(structuredData.description).toBe(publicPage.description);
      expect(structuredData.inLanguage).toBe(SITE.language);

      const imageResponse = await request.get(EXPECTED_SOCIAL_IMAGE_PATH);
      expect(imageResponse.status()).toBe(200);
      expect(imageResponse.headers()["content-type"]).toContain("image/png");
    }

    expectCleanDiagnostics(diagnostics);
  });

  test("utility pages are deliberately noindex without canonical or social metadata", async ({
    page,
  }) => {
    const diagnostics = collectRuntimeDiagnostics(page);

    for (const utilityPage of UTILITY_PAGES) {
      const response = await page.goto(utilityPage.runtimePath, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), utilityPage.runtimePath).toBe(200);
      await expect(page).toHaveTitle(utilityPage.title);
      await expectSingleMeta(page, 'meta[name="robots"]', "noindex, nofollow");
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
      await expect(page.locator('meta[name^="twitter:"]')).toHaveCount(0);
      await expect(
        page.locator('script[type="application/ld+json"]'),
      ).toHaveCount(0);
    }

    expectCleanDiagnostics(diagnostics);
  });

  test("sitemap and robots expose exactly the indexable canonical route set", async ({
    request,
  }) => {
    const sitemapResponse = await request.get("/sitemap.xml");
    expect(sitemapResponse.status()).toBe(200);
    const sitemap = await sitemapResponse.text();
    const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
      (match) => match[1],
    );
    expect(sitemapUrls).toEqual(
      INDEXABLE_PAGES.map((publicPage) => absoluteUrl(publicPage.path)),
    );
    expect(sitemap).not.toContain("<lastmod>");
    for (const utilityPage of UTILITY_PAGES) {
      expect(sitemapUrls).not.toContain(absoluteUrl(utilityPage.path));
    }

    const robotsResponse = await request.get("/robots.txt");
    expect(robotsResponse.status()).toBe(200);
    const robots = await robotsResponse.text();
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain(`Sitemap: ${absoluteUrl("/sitemap.xml")}`);
    expect(robots.match(/^Sitemap:/gmu)).toHaveLength(1);
  });
});
