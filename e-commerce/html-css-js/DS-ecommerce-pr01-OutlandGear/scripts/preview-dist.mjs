import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 4173);

const CONTENT_TYPES = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

const send = (res, statusCode, body, contentType = "text/plain; charset=utf-8") => {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
};

const resolveRequestPath = async (requestUrl) => {
  const pathname = decodeURIComponent(
    new URL(requestUrl, `http://127.0.0.1:${PORT}`).pathname,
  );
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const targetPath = path.normalize(path.join(DIST, normalized));

  if (!targetPath.startsWith(DIST)) {
    return null;
  }

  try {
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      const directoryIndex = path.join(targetPath, "index.html");
      await fs.access(directoryIndex);
      return directoryIndex;
    }
    return targetPath;
  } catch {
    return null;
  }
};

// Mirrors Netlify's behaviour: an unmatched route is answered with the built
// 404 page at the requested URL, not a redirect. Falls back to plain text when
// dist/404.html is absent (e.g. a partial build).
const sendNotFound = async (res) => {
  try {
    const notFoundPage = await fs.readFile(path.join(DIST, "404.html"));
    send(res, 404, notFoundPage, CONTENT_TYPES[".html"]);
  } catch {
    send(res, 404, "Not found");
  }
};

const server = createServer(async (req, res) => {
  const filePath = await resolveRequestPath(req.url || "/");

  if (!filePath) {
    await sendNotFound(res);
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, CONTENT_TYPES[ext] || "application/octet-stream");
  } catch (error) {
    send(res, 500, `Preview server error: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Dist preview running at http://127.0.0.1:${PORT}`);
  console.log("Serving folder: dist");
});
