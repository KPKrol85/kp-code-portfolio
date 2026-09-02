import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { defineConfig } from "vite";

import { ALL_PAGES } from "./scripts/site-config.mjs";

const runNode = promisify(execFile);

const ROOT = import.meta.dirname;

const pageInputs = Object.fromEntries(
  ALL_PAGES.map((page) => [page.key, resolve(ROOT, page.file)]),
);

// Editing one of these regenerates the shared HTML regions and routing assets,
// so the development server must reassemble before the browser reloads.
const HTML_BUILD_DEPENDENCIES = [
  "scripts/build-html.mjs",
  "scripts/content-renderers.mjs",
  "scripts/shared-shell.mjs",
  "scripts/site-config.mjs",
  "js/data/materialAccess.js",
  "js/data/materialFilters.js",
  "js/data/materials.js",
  "js/data/packages.js",
].map((file) => resolve(ROOT, file));

// Vite serves the assembled HTML documents but never produces them. Without
// this watcher a change to an assembler source would be served as stale HTML.
const htmlAssembly = () => {
  let running = false;
  let queued = false;

  const assemble = async () => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      const { stdout } = await runNode(
        process.execPath,
        ["scripts/build-html.mjs"],
        { cwd: ROOT },
      );
      process.stdout.write(stdout);
    } catch (error) {
      console.error(`[html] Assembly failed: ${error.stderr || error.message}`);
    } finally {
      running = false;
      if (queued) {
        queued = false;
        await assemble();
      }
    }
  };

  return {
    name: "lauren-english-html-assembly",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(HTML_BUILD_DEPENDENCIES);
      server.watcher.on("change", (file) => {
        if (HTML_BUILD_DEPENDENCIES.includes(resolve(file))) void assemble();
      });
    },
  };
};

export default defineConfig({
  appType: "mpa",
  publicDir: ".vite-public",
  plugins: [htmlAssembly()],

  // js/main.js recognizes the local development origin by port, and that
  // detection is what keeps Service Worker state from masking source changes.
  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    outDir: "dist",
    assetsDir: "build",
    emptyOutDir: true,
    rolldownOptions: {
      input: pageInputs,
    },
  },
});
