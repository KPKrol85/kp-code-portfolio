import { spawn } from "child_process";
import http from "http";

const host = "127.0.0.1";
const port = Number(process.env.CHECK_SERVER_PROD_PORT || 4180);
const timeoutMs = 8000;
const pathsToCheck = ["/", "/menu.html"];

function requestPath(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: pathname, timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Timeout while requesting ${pathname}`));
    });

    req.on("error", reject);
  });
}

async function waitForServerReady() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const status = await requestPath("/");
      if (status === 200) {
        return;
      }
    } catch {
      // wait and retry until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Static server did not become ready within ${timeoutMs}ms`);
}

async function run() {
  const server = spawn(process.execPath, ["scripts/lhci-static-server.mjs"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      LHCI_HOST: host,
      LHCI_PORT: String(port)
    }
  });

  server.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });

  server.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  try {
    await waitForServerReady();

    for (const pathname of pathsToCheck) {
      const status = await requestPath(pathname);
      if (status !== 200) {
        throw new Error(`Expected 200 for ${pathname}, received ${status}`);
      }
      console.log(`CHECK SERVER PROD OK: ${pathname} -> ${status}`);
    }
  } finally {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
    await new Promise((resolve) => {
      server.once("exit", () => resolve());
      setTimeout(() => resolve(), 1000);
    });
  }
}

run().catch((error) => {
  console.error(`CHECK SERVER PROD FAILED: ${error.message}`);
  process.exit(1);
});
