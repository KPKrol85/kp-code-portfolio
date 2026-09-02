/* Deterministic local static server for the browser-driven QA harnesses.

   Pages are served straight from the maintained sources in the repository
   root and expanded through the shared partial renderer, so a browser test
   drives the same document `npm run dev` and the production build produce —
   never a test-only copy of the markup. The server binds an ephemeral port on
   127.0.0.1 and depends on nothing outside the working tree.

   scripts/qa-a11y.mjs deliberately keeps its own equivalent server: that gate
   carries the O-05 route contract and the O-06 verification, and rewiring a
   passing accessibility harness is not part of adding functional tests. */

import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveContentType } from "./mime-types.mjs";
import partials from "./partials.js";

const { renderHtmlFile } = partials;

async function safeStat(file) {
  try {
    return await fs.stat(file);
  } catch {
    return null;
  }
}

/* Maps a request path onto a file inside rootDir, or null when the path would
   escape it. */
function resolveServerPath(rootDir, urlPath) {
  const withoutQuery = urlPath.split("?")[0].split("#")[0];
  const relative =
    decodeURIComponent(withoutQuery).replace(/^\/+/, "") || "index.html";
  const absPath = path.resolve(rootDir, relative);
  const contained =
    absPath === rootDir || absPath.startsWith(rootDir + path.sep);
  return contained ? absPath : null;
}

async function startStaticServer({ rootDir = process.cwd() } = {}) {
  const root = path.resolve(rootDir);

  const server = createServer(async (req, res) => {
    let filePath = resolveServerPath(root, req.url || "/");

    if (filePath) {
      const stat = await safeStat(filePath);
      if (stat?.isDirectory()) filePath = path.join(filePath, "index.html");
    }

    const exists = filePath ? await safeStat(filePath) : null;
    if (!exists?.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    try {
      const body =
        ext === ".html"
          ? Buffer.from(
              (await renderHtmlFile(filePath, { rootDir: root })).html,
              "utf8",
            )
          : await fs.readFile(filePath);

      res.writeHead(200, {
        "Content-Type": resolveContentType(ext),
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Render failed: ${error.message}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

export { startStaticServer };
