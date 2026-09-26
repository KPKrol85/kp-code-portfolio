const fs = require("node:fs");
const path = require("node:path");
const { Buffer } = require("node:buffer");
const httpServer = require("http-server");
const { rootDir, htmlPages, composePage } = require("./build-config.js");

const HOST = "127.0.0.1";
const PORT = 5173;
const NOT_FOUND_PAGE = "404.html";
const NO_CACHE = "no-cache, no-store, must-revalidate";

/*
 The decoded request path, held inside the site root the way http-server holds it. Leading slashes
 are collapsed first, so "//about.html" stays a path and never becomes a host. Null when the path
 cannot be decoded, which http-server then answers with its own 400.
*/
function requestPath(url) {
  try {
    const { pathname } = new URL(url.replace(/^\/+/, "/"), "http://localhost");
    return path.posix.normalize(decodeURIComponent(pathname).replace(/\\/g, "/"));
  } catch {
    return null;
  }
}

/*
 The page a target names: the site root, a root page or that page without its .html extension, as
 http-server resolved them before composition existed. Names compare case-insensitively because the
 Windows file system does, so no spelling of a page route reaches its raw template.
*/
function pageAt(target) {
  const name = path.relative(rootDir, target).toLowerCase();
  if (!name) return "index.html";
  return htmlPages.find((page) => page === name || page === `${name}.html`) || null;
}

function send(req, res, status, type, body) {
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": NO_CACHE,
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

// A composition error reaches the browser and the terminal as plain text, never as an incomplete page.
function sendPage(req, res, status, page) {
  let html;
  try {
    html = composePage(page);
  } catch (error) {
    console.error(error.message);
    send(req, res, 500, "text/plain; charset=UTF-8", `${error.message}\n`);
    return;
  }
  send(req, res, status, "text/html; charset=UTF-8", html);
}

/*
 Page routes are composed in memory on every request, so an edited template or partial shows after
 an ordinary refresh. A missing path answers with the composed 404 page and status 404, as dist/ does
 on Netlify. Everything else continues to http-server unchanged: CSS, ES modules, bootstrap.js, data,
 assets and directory listings, the 405 for other methods and the 400 for undecodable paths.
*/
function serveComposedPage(req, res) {
  const pathname = req.method === "GET" || req.method === "HEAD" ? requestPath(req.url) : null;
  if (pathname === null) {
    res.emit("next");
    return;
  }
  const target = path.join(rootDir, pathname);
  const page = pageAt(target);
  if (page) {
    sendPage(req, res, 200, page);
  } else if (!fs.existsSync(target)) {
    sendPage(req, res, 404, NOT_FOUND_PAGE);
  } else {
    res.emit("next");
  }
}

function logRequest(req, res) {
  console.log(`[${new Date().toISOString()}] "${req.method} ${req.url}"`);
  res.emit("next");
}

// The repository source with composed pages; scripts/qa-server.js checks the same server.
function createSourceServer({ log = false } = {}) {
  return httpServer.createServer({
    root: rootDir,
    cache: -1,
    before: log ? [logRequest, serveComposedPage] : [serveComposedPage],
  });
}

if (require.main === module) {
  const server = createSourceServer({ log: true });
  server.server.once("error", (error) => {
    console.error(`Dev server could not start on http://${HOST}:${PORT}: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(PORT, HOST, () => {
    console.log(`Atelier No.02 dev server at http://${HOST}:${PORT}`);
    console.log("Pages are composed from their templates and partials/ on every request. Press Ctrl+C to stop.");
  });
}

module.exports = { createSourceServer };
