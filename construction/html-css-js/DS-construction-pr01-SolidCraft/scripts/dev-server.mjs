/* Local development server for SolidCraft.

   Serves the maintained sources straight from the repository root and expands
   every HTML request through the shared partial renderer, so a browser sees
   the same document the production build emits — never a dev-only variant.

   Deliberately dependency-free: the project already serves pages this way in
   scripts/utils/static-server.mjs (functional QA) and scripts/qa-a11y.mjs, so
   the leaf helpers below are shared rather than reimplemented. Live reload is
   a Server-Sent Events stream, which needs no WebSocket library and lets the
   browser's own EventSource handle reconnection.

   Binds 127.0.0.1 only, serves no directory listings, and fails loudly when
   the documented port is taken rather than drifting to a random one. */

import { createServer } from "node:http";
import { promises as fs, watch } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveContentType } from "./utils/mime-types.mjs";
import partials from "./utils/partials.js";
import loggerUtils from "./utils/logger.js";

const { renderHtmlFile } = partials;
const { createLogger } = loggerUtils;

const logger = createLogger();

const rootDir = path.resolve(process.cwd());
const HOST = "127.0.0.1";
const PORT = 15500;
const ENTRY_FILE = "index.html";
const RELOAD_PATH = "/__dev/reload";
const DEBOUNCE_MS = 100;

/* Directories that never affect a rendered page. Excluded when the watchers
   are created rather than filtered afterwards, so the OS is never asked to
   watch node_modules/ recursively. Dot-directories (.git, .github, ...) are
   skipped by the same rule below. */
const IGNORED_DIR_NAMES = new Set(["node_modules", "dist"]);

/* Reload client. EventSource reconnects on its own, so a dev-server restart
   recovers without the developer touching the page — the previous live-server
   client had no reconnect path at all. */
const RELOAD_CLIENT = `
<!-- Injected by scripts/dev-server.mjs -->
<script>
  (function () {
    if (!("EventSource" in window)) return;

    var source = new EventSource(${JSON.stringify(RELOAD_PATH)});
    var wasDisconnected = false;

    /* Re-point every stylesheet at a cache-busted URL. The element is reused
       instead of replaced, so scroll position and DOM state survive. */
    function refreshStylesheets() {
      var links = document.querySelectorAll('link[rel="stylesheet"]');
      for (var i = 0; i < links.length; i++) {
        if (!links[i].href) continue;
        var url = links[i].href.replace(/[?&]__dev=\\d+/, "");
        links[i].href =
          url + (url.indexOf("?") >= 0 ? "&" : "?") + "__dev=" + Date.now();
      }
    }

    source.onmessage = function (event) {
      if (event.data === "reload") window.location.reload();
      else if (event.data === "refreshcss") refreshStylesheets();
    };

    source.onopen = function () {
      /* The stream dropped and came back: the server restarted, so pick up
         whatever changed while this page was not listening. */
      if (wasDisconnected) window.location.reload();
    };

    source.onerror = function () {
      wasDisconnected = true;
    };
  })();
</script>
`;

const reloadClients = new Set();

function injectReloadClient(html) {
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${RELOAD_CLIENT}</body>`)
    : html + RELOAD_CLIENT;
}

async function safeStat(target) {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

/* Maps a request path onto a file inside rootDir, or null when it would escape
   the project root or cannot be decoded. */
function resolveRequestPath(requestUrl) {
  const raw = (requestUrl || "/").split("?")[0].split("#")[0];

  let pathname;
  try {
    pathname = decodeURIComponent(raw);
  } catch {
    return null;
  }

  const relative = pathname.replace(/^\/+/, "") || ENTRY_FILE;
  const absPath = path.resolve(rootDir, relative);
  const contained =
    absPath === rootDir || absPath.startsWith(rootDir + path.sep);

  return contained ? absPath : null;
}

function sendPlain(res, statusCode, message, method) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(method === "HEAD" ? undefined : message);
}

function openReloadStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });
  res.write("retry: 500\n\n");

  reloadClients.add(res);
  req.on("close", () => reloadClients.delete(res));
}

function broadcast(message) {
  for (const client of reloadClients) client.write(`data: ${message}\n\n`);
}

async function handleRequest(req, res) {
  const method = req.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    sendPlain(res, 405, "Method not allowed", method);
    return;
  }

  const requestUrl = req.url || "/";
  if (requestUrl.split("?")[0] === RELOAD_PATH) {
    openReloadStream(req, res);
    return;
  }

  const resolved = resolveRequestPath(requestUrl);
  if (!resolved) {
    sendPlain(res, 404, "Not found", method);
    return;
  }

  /* A directory is routable only through its index.html; its contents are
     never listed, matching the production _redirects contract. */
  const resolvedStat = await safeStat(resolved);
  const target = resolvedStat?.isDirectory()
    ? path.join(resolved, ENTRY_FILE)
    : resolved;
  const targetStat = resolvedStat?.isDirectory()
    ? await safeStat(target)
    : resolvedStat;

  if (!targetStat?.isFile()) {
    sendPlain(res, 404, "Not found", method);
    return;
  }

  const ext = path.extname(target).toLowerCase();

  try {
    const body =
      ext === ".html"
        ? Buffer.from(
            injectReloadClient((await renderHtmlFile(target, { rootDir })).html),
            "utf8",
          )
        : await fs.readFile(target);

    res.writeHead(200, {
      "Content-Type": resolveContentType(ext),
      "Content-Length": body.length,
      "Cache-Control": "no-store",
    });
    res.end(method === "HEAD" ? undefined : body);
  } catch (error) {
    logger.error(`FAIL: ${error.message}`);
    sendPlain(res, 500, `Render failed.\n\n${error.message}\n`, method);
  }
}

/* Editor scratch files (.swp, #foo#, foo~) would otherwise reload the page
   mid-keystroke. */
function isIgnoredFile(absPath) {
  const base = path.basename(absPath);
  return /^[.#]/.test(base) || /(?:~|__)$/.test(base);
}

let pendingChanges = new Set();
let debounceTimer = null;

/* One save can raise several fs events, so changes are collected and flushed
   once. A batch touching only stylesheets refreshes CSS in place; anything
   else reloads the page.

   Saving a file also notifies its containing directory, and that notification
   can arrive in a later batch than the file's own. Those entries are dropped
   by asking the filesystem what the path is now — an extension test is not
   enough, and treating a stray directory event as a change turns a stylesheet
   save into a spurious full reload. A path that no longer exists is a genuine
   deletion and is kept. */
async function flushChanges() {
  debounceTimer = null;

  const changed = [...pendingChanges];
  pendingChanges = new Set();
  if (changed.length === 0) return;

  const files = [];
  for (const candidate of changed) {
    const stat = await safeStat(candidate);
    if (!stat?.isDirectory()) files.push(candidate);
  }
  if (files.length === 0) return;

  const cssOnly = files.every(
    (file) => path.extname(file).toLowerCase() === ".css",
  );

  logger.debug(
    `${cssOnly ? "CSS change" : "Change"} detected: ${files
      .map((file) => path.relative(rootDir, file))
      .join(", ")}`,
  );

  broadcast(cssOnly ? "refreshcss" : "reload");
}

function scheduleChange(absPath) {
  pendingChanges.add(absPath);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    /* A failed broadcast must never take the server down with it. */
    flushChanges().catch((error) =>
      logger.warn(`WARN: reload broadcast failed: ${error.message}`),
    );
  }, DEBOUNCE_MS);
}

async function startWatching() {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  const targets = [{ dir: rootDir, recursive: false }];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || IGNORED_DIR_NAMES.has(entry.name)) {
      continue;
    }
    targets.push({ dir: path.join(rootDir, entry.name), recursive: true });
  }

  const watchers = [];
  for (const { dir, recursive } of targets) {
    const label = path.relative(rootDir, dir) || ".";
    try {
      const watcher = watch(dir, { recursive }, (_event, filename) => {
        if (!filename) return;
        const absPath = path.join(dir, filename.toString());
        if (isIgnoredFile(absPath)) return;
        scheduleChange(absPath);
      });
      watcher.on("error", (error) =>
        logger.warn(`WARN: file watcher failed for ${label}: ${error.message}`),
      );
      watchers.push(watcher);
    } catch (error) {
      logger.warn(
        `WARN: cannot watch ${label}: ${error.message}. Changes there will not reload the browser.`,
      );
    }
  }

  return watchers;
}

/* Best effort by design: a machine without a launchable browser still gets a
   working server. */
function openBrowser(url) {
  const launcher =
    process.platform === "win32"
      ? { command: "cmd", args: ["/c", "start", "", url] }
      : process.platform === "darwin"
        ? { command: "open", args: [url] }
        : { command: "xdg-open", args: [url] };

  try {
    const child = spawn(launcher.command, launcher.args, {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", (error) =>
      logger.warn(
        `WARN: could not open a browser automatically (${error.message}).`,
      ),
    );
    child.unref();
  } catch (error) {
    logger.warn(
      `WARN: could not open a browser automatically (${error.message}).`,
    );
  }
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    logger.error(`FAIL: ${error.message}`);
    if (res.headersSent) res.end();
    else sendPlain(res, 500, "Internal error", req.method);
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(
      `FAIL: port ${PORT} is already in use. Stop whatever is serving http://${HOST}:${PORT}/ and run "npm run dev" again.`,
    );
  } else {
    logger.error(`FAIL: dev server could not start: ${error.message}`);
  }
  process.exit(1);
});

let watchers = [];

server.listen(PORT, HOST, async () => {
  const url = `http://${HOST}:${PORT}/`;

  watchers = await startWatching();
  if (process.env.DEV_SERVER_NO_OPEN !== "1") openBrowser(url);

  logger.summary(
    `OK: dev server on ${url} (shared partials rendered per request, live reload active).`,
  );
});

function shutdown() {
  for (const watcher of watchers) watcher.close();
  for (const client of reloadClients) client.end();
  reloadClients.clear();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
