const { test, expect } = require("@playwright/test");

async function openFresh(page, target = "/", theme = "light") {
  await page.goto("/");
  await page.evaluate((selectedTheme) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("fleet-theme", JSON.stringify(selectedTheme));
  }, theme);
  await page.goto(target);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function loginAsDemo(page, theme) {
  await openFresh(page, "/#/login", theme);
  await page.getByRole("button", { name: "Kontynuuj jako demo" }).click();
  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.getByRole("heading", { name: "Przegląd", level: 1 })).toBeVisible();
}

async function measureContrast(locator, { gradient = false, boundary = false, focus = false } = {}) {
  return locator.evaluate((element, options) => {
    const clamp = (value) => Math.min(1, Math.max(0, value));

    const parseColor = (value) => {
      const text = String(value || "").trim().toLowerCase();
      if (!text || text === "transparent") return [0, 0, 0, 0];

      const srgb = text.match(/^color\(srgb\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)(?:\s*\/\s*([\d.+-]+))?\)$/);
      if (srgb) {
        return [clamp(Number(srgb[1])), clamp(Number(srgb[2])), clamp(Number(srgb[3])), clamp(Number(srgb[4] ?? 1))];
      }

      const rgb = text.match(/^rgba?\(\s*([\d.]+)(?:\s+|\s*,\s*)([\d.]+)(?:\s+|\s*,\s*)([\d.]+)(?:\s*(?:\/|,)\s*([\d.]+)%?)?\s*\)$/);
      if (rgb) {
        const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (text.includes("%") ? 100 : 1);
        return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255, clamp(alpha)];
      }

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillStyle = text;
      context.fillRect(0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255, pixel[3] / 255];
    };

    const composite = (top, bottom) => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [
        (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
        (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
        (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
        alpha,
      ];
    };

    const effectiveBackground = (start) => {
      let result = [0, 0, 0, 0];
      let current = start;

      while (current) {
        result = composite(result, parseColor(getComputedStyle(current).backgroundColor));
        if (result[3] >= 0.999) return result;
        current = current.parentElement;
      }

      return composite(result, [1, 1, 1, 1]);
    };

    const luminance = (color) => {
      const channels = color.slice(0, 3).map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      );
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };

    const ratio = (first, second) => {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    };

    const toHex = (color) =>
      `#${color
        .slice(0, 3)
        .map((channel) => Math.round(clamp(channel) * 255).toString(16).padStart(2, "0"))
        .join("")}`;

    const style = getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize) || 0;
    const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
    const threshold = options.boundary || options.focus ? 3 : fontSize >= 24 || (fontSize >= 18.666 && fontWeight >= 700) ? 3 : 4.5;
    const surrounding = effectiveBackground(options.boundary || options.focus ? element.parentElement : element);
    let foreground = parseColor(options.boundary ? style.borderTopColor : options.focus ? style.outlineColor : style.color);
    let backgrounds = [surrounding];

    if (options.gradient) {
      const stops = style.backgroundImage.match(/color\(srgb\s+[^)]+\)|rgba?\([^)]+\)/g) || [];
      if (!stops.length) throw new Error(`No computed gradient stops found for ${element.className}`);
      const base = effectiveBackground(element);
      backgrounds = stops.map((stop) => composite(parseColor(stop), base));
    }

    if (foreground[3] < 1) foreground = composite(foreground, backgrounds[0]);
    const ratios = backgrounds.map((background) => ratio(foreground, background));
    const minimum = Math.min(...ratios);
    const minimumIndex = ratios.indexOf(minimum);

    return {
      foreground: toHex(foreground),
      background: toHex(backgrounds[minimumIndex]),
      ratio: Number(minimum.toFixed(2)),
      threshold,
      fontSize,
      fontWeight,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  }, { gradient, boundary, focus });
}

async function recordEvidence(rows, theme, area, state, locator, options = {}) {
  const result = await measureContrast(locator, options);
  rows.push({ theme, area, state, ...result });
  return result;
}

test("representative rendered contrast meets the recorded WCAG AA reference thresholds in both themes", async ({ page }) => {
  const rows = [];

  for (const theme of ["light", "dark"]) {
    await openFresh(page, "/", theme);

    await recordEvidence(rows, theme, "feature card heading", "default", page.locator(".card--feature .card__title").first());
    await recordEvidence(rows, theme, "feature card body", "muted text", page.locator(".card--feature .card__text").first());
    await recordEvidence(rows, theme, "section tag", "accent text", page.locator(".section-header .tag").first());
    await recordEvidence(rows, theme, "primary action", "default gradient", page.locator(".hero-cta .button--primary"), { gradient: true });
    await recordEvidence(rows, theme, "secondary action", "default gradient", page.locator(".hero-cta .button--secondary"), { gradient: true });
    await recordEvidence(rows, theme, "accordion", "collapsed control", page.locator("#faq .accordion-header").first());
    await recordEvidence(rows, theme, "footer contact", "muted text", page.locator(".footer__contact-text").first());

    const primary = page.locator(".hero-cta .button--primary");
    await primary.hover();
    await recordEvidence(rows, theme, "primary action", "hover gradient", primary, { gradient: true });
    await primary.focus();
    await expect(primary).toBeFocused();
    const focusResult = await recordEvidence(rows, theme, "primary action", "keyboard focus indicator", primary, { focus: true });
    expect(focusResult.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusResult.outlineWidth)).toBeGreaterThanOrEqual(2);

    await loginAsDemo(page, theme);
    await page.locator('.sidebar nav a[data-route="/app/orders"]').click();
    await expect(page.getByRole("heading", { name: "Zlecenia", level: 1 })).toBeVisible();

    await recordEvidence(rows, theme, "application navigation", "current route", page.locator('.sidebar nav a[aria-current="page"]'));
    await recordEvidence(rows, theme, "user menu", "avatar text", page.locator("#userMenuBtn"));
    await recordEvidence(rows, theme, "orders table", "cell text", page.locator("tr.order-row td").nth(1));
    await recordEvidence(rows, theme, "orders table", "muted header", page.locator(".table th").first());

    for (const status of ["in-progress", "delayed", "delivered", "pending"]) {
      const badge = page.locator(`.badge.status.${status}`).first();
      if (await badge.count()) await recordEvidence(rows, theme, "status badge", status, badge);
    }

    const addOrder = page.getByRole("button", { name: "Dodaj zlecenie" });
    await addOrder.click();
    const dialog = page.getByRole("dialog", { name: "Dodaj zlecenie" });
    const client = dialog.getByLabel("Klient");
    await recordEvidence(rows, theme, "modal form", "label", dialog.locator(".label").first());
    await recordEvidence(rows, theme, "modal form", "input text", client);
    await recordEvidence(rows, theme, "modal form", "active control boundary", client, { boundary: true });

    await dialog.getByRole("button", { name: "Dodaj zlecenie" }).click();
    await expect(client).toHaveAttribute("aria-invalid", "true");
    const danger = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--danger)";
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    });
    await expect.poll(async () => client.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(danger);
    await recordEvidence(rows, theme, "modal form", "error text", dialog.locator('[data-error-for="client"]'));
    await recordEvidence(rows, theme, "modal form", "invalid control boundary", client, { boundary: true });

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    const detailsTrigger = page.locator("tr.order-row [data-record-detail]").first();
    await detailsTrigger.click();
    const drawer = page.getByRole("dialog", { name: /Zlecenie FO-/ });
    await recordEvidence(rows, theme, "record drawer", "detail label", drawer.locator(".record-drawer__term").first());
    await recordEvidence(rows, theme, "record drawer", "detail value", drawer.locator(".record-drawer__description").first());
    await page.keyboard.press("Escape");
  }

  if (process.env.FLEETOPS_ACCESSIBILITY_EVIDENCE === "1") {
    console.log(`FLEETOPS_CONTRAST_EVIDENCE=${JSON.stringify(rows)}`);
  }

  const failures = rows
    .filter(({ ratio, threshold }) => ratio < threshold)
    .map(({ theme, area, state, foreground, background, ratio, threshold }) =>
      `${theme} ${area} (${state}): ${foreground} on ${background}; ${ratio}:1 below ${threshold}:1`
    );
  expect(failures, failures.join("\n")).toEqual([]);
});

test("public navigation and accordion complete representative keyboard-only flows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openFresh(page);

  const skipLink = page.locator(".skip-link");
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();

  const navToggle = page.locator("#navToggle");
  await navToggle.focus();
  await page.keyboard.press("Enter");
  const mobileNav = page.locator("#mobileNav");
  const firstNavItem = mobileNav.locator('a[href="/product/"]');
  const lastNavItem = mobileNav.locator("#themeToggleLanding");
  await expect(navToggle).toHaveAttribute("aria-expanded", "true");
  await expect(mobileNav).toHaveAttribute("aria-hidden", "false");
  await expect(firstNavItem).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(lastNavItem).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstNavItem).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(navToggle).toHaveAttribute("aria-expanded", "false");
  await expect(navToggle).toBeFocused();

  const accordion = page.locator("#faq .accordion-header").first();
  await accordion.focus();
  await page.keyboard.press("Space");
  await expect(accordion).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(accordion).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => accordion.locator("..").locator(".accordion-content").evaluate((panel) => panel.hidden)).toBe(true);
});

test("route announcements and modal focus management remain observable during keyboard use", async ({ page }) => {
  await loginAsDemo(page, "light");
  const routeStatus = page.locator("#fleetops-route-status");
  await expect(routeStatus).toHaveAttribute("role", "status");
  await expect(routeStatus).toHaveAttribute("aria-live", "polite");
  await expect(routeStatus).toHaveText("Widok: Przegląd");

  const ordersLink = page.locator('.sidebar nav a[data-route="/app/orders"]');
  await ordersLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/app\/orders$/);
  await expect(routeStatus).toHaveText("Widok: Zlecenia");
  await expect(page.locator('.sidebar nav a[data-route="/app/orders"]')).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement?.isConnected)).toBe(true);

  const addOrder = page.getByRole("button", { name: "Dodaj zlecenie" });
  await addOrder.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Dodaj zlecenie" });
  const close = dialog.getByRole("button", { name: "Zamknij" });
  const submit = dialog.getByRole("button", { name: "Dodaj zlecenie" });
  await expect(close).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(addOrder).toBeFocused();
});
