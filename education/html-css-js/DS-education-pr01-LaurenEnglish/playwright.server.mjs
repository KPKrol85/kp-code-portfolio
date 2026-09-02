import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

export const createVitePreviewServer = (baseUrl) => {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port) {
    throw new Error(
      `Playwright Vite preview requires an explicit 127.0.0.1 HTTP origin: ${baseUrl}`,
    );
  }

  return {
    command: `npm run build && npm exec vite -- preview --host ${url.hostname} --port ${url.port} --strictPort`,
    cwd: ROOT,
    url: new URL("/index.html", url).href,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  };
};
