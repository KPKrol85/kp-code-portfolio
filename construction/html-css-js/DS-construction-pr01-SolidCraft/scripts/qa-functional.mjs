#!/usr/bin/env node

/* Functional browser gate.

   Drives the project's four important interactive paths — the responsive
   navigation drawer, the Oferta submenu, the service-gallery lightbox and the
   contact form — in headless Chromium, against the maintained sources served
   locally through the shared partial renderer.

   The harness deliberately mirrors scripts/qa-a11y.mjs rather than adding a
   test framework: the same already-declared `playwright` package, a plain Node
   script, an in-process static server on an ephemeral port, one PASS/FAIL line
   per scenario and a non-zero exit code when any assertion fails. No new
   dependency is involved and nothing reaches the network.

   Every scenario owns its browser context, and the browser and server are
   closed in the finally path whether the run passed or failed.

   Usage: node scripts/qa-functional.mjs [--only=<substring of scenario name>] */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "./utils/static-server.mjs";
import { navigationScenarios } from "./functional/navigation.mjs";
import { lightboxScenarios } from "./functional/lightbox.mjs";
import { contactFormScenarios } from "./functional/contact-form.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const allScenarios = [
  ...navigationScenarios,
  ...lightboxScenarios,
  ...contactFormScenarios,
];

const only = readOnlyFilter(process.argv.slice(2));
const scenarios = only
  ? allScenarios.filter((scenario) => scenario.name.includes(only))
  : allScenarios;

if (scenarios.length === 0) {
  console.error(`FAIL qa:functional (no scenario matches "${only}")`);
  process.exit(1);
}

const { chromium } = await loadDependency("playwright");

const server = await startStaticServer({ rootDir: projectRoot });
const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const scenario of scenarios) {
    const startedAt = Date.now();

    try {
      await scenario.run({ browser, baseURL: server.origin });
      console.log(`PASS ${scenario.name} (${Date.now() - startedAt} ms)`);
    } catch (error) {
      const message = error?.message || String(error);
      failures.push({ name: scenario.name, message });
      console.error(`FAIL ${scenario.name} (${Date.now() - startedAt} ms)`);
      console.error(`  ${message.split("\n")[0]}`);
      if (error?.name !== "AssertionError" && error?.stack) {
        console.error(`  ${error.stack.split("\n").slice(1, 3).join("\n  ")}`);
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  console.error(
    `FAIL qa:functional (${failures.length} of ${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} failed)`,
  );
  for (const failure of failures) {
    console.error(`- ${failure.name} | ${failure.message.split("\n")[0]}`);
  }
  process.exit(1);
}

console.log(
  `PASS qa:functional (${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"}, 0 failures)`,
);

function readOnlyFilter(argv) {
  const flag = argv.find((arg) => arg.startsWith("--only="));
  return flag ? flag.slice("--only=".length) : "";
}

async function loadDependency(name) {
  try {
    return await import(name);
  } catch {
    console.error(
      `Missing dependency: ${name}. Run "npm install" to install local QA tooling.`,
    );
    process.exit(1);
  }
}
