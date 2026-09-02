import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { startLocalQaServer } from "./local-server.mjs";

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, "reports", "lighthouse");

// Resolved the same repository-local way the server helper resolves
// http-server: the package entry point, run with the current Node binary.
const lhciEntry = path.join(rootDir, "node_modules", "@lhci", "cli", "src", "cli.js");

const args = [
  "collect",
  "--url=http://localhost:8080/",
  "--url=http://localhost:8080/services/budowa-domow.html",
  "--url=http://localhost:8080/legal/regulamin.html",
  "--outputDir=reports/lighthouse",
];

const runLhci = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [lhciEntry, ...args], {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`lhci collect failed with exit code ${code}`));
    });
  });

const run = async () => {
  await fs.mkdir(reportsDir, { recursive: true });

  const server = await startLocalQaServer({ rootDir });

  try {
    await runLhci();
  } finally {
    await server.stop();
  }
};

try {
  await run();
} catch (error) {
  console.error(`Lighthouse audit failed: ${error.message}`);
  process.exitCode = 1;
}
