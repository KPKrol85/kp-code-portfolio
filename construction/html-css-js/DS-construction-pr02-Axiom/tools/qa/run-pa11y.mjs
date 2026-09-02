import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { startLocalQaServer } from "./local-server.mjs";

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, "reports", "pa11y");

// Resolved the same repository-local way the server helper resolves
// http-server: the package entry point, run with the current Node binary.
const pa11yEntry = path.join(rootDir, "node_modules", "pa11y", "bin", "pa11y.js");

const checks = [
  { url: "http://localhost:8080/", report: "index.json" },
  {
    url: "http://localhost:8080/services/budowa-domow.html",
    report: "budowa-domow.json",
  },
  { url: "http://localhost:8080/legal/regulamin.html", report: "regulamin.json" },
];

const runPa11y = async (url) => {
  const args = [pa11yEntry, url, "--reporter", "json"];

  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];

    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", reject);

    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

      if (code === 0) {
        resolve(stdout);
        return;
      }

      const message = stderr || `pa11y failed for ${url} with exit code ${code}`;
      reject(new Error(message));
    });
  });
};

const run = async () => {
  await fs.mkdir(reportsDir, { recursive: true });

  const server = await startLocalQaServer({ rootDir });

  try {
    for (const check of checks) {
      const output = await runPa11y(check.url);
      const reportPath = path.join(reportsDir, check.report);

      await fs.writeFile(reportPath, output, "utf8");
      console.log(`Saved ${path.relative(rootDir, reportPath)}`);
    }
  } finally {
    await server.stop();
  }
};

try {
  await run();
} catch (error) {
  console.error(`Accessibility audit failed: ${error.message}`);
  process.exitCode = 1;
}
