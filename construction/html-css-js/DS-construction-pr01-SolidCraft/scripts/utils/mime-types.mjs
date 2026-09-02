const DEFAULT_CONTENT_TYPE = "application/octet-stream";

const CONTENT_TYPES_BY_EXTENSION = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

function resolveContentType(extension) {
  const normalized = String(extension || "").toLowerCase();
  return CONTENT_TYPES_BY_EXTENSION[normalized] || DEFAULT_CONTENT_TYPE;
}

export { CONTENT_TYPES_BY_EXTENSION, DEFAULT_CONTENT_TYPE, resolveContentType };
