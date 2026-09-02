import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

// The audited QA URLs are fixed, so the owned server always binds this exact
// port. A conflict is reported rather than worked around: the runner must never
// adopt or terminate an unrelated service that already listens here.
const PORT = 8080;

// `localhost` can resolve to either stack, so both are probed before startup.
const PROBE_HOSTS = ["127.0.0.1", "::1"];

const PROBE_TIMEOUT_MS = 1000;
const READY_TIMEOUT_MS = 20000;
const READY_INTERVAL_MS = 200;
const STOP_TIMEOUT_MS = 5000;
const CAPTURED_OUTPUT_LIMIT = 4000;

const BASE_URL = `http://localhost:${PORT}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isListening = (host) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port: PORT });

    const settle = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });

const isPortOccupied = async () => {
  for (const host of PROBE_HOSTS) {
    if (await isListening(host)) {
      return true;
    }
  }

  return false;
};

// Keeps only the tail of the server output so a startup failure can report what
// http-server actually printed without buffering an unbounded request log.
const createOutputCollector = () => {
  let text = "";

  return {
    attach(stream) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        text = (text + chunk).slice(-CAPTURED_OUTPUT_LIMIT);
      });
    },
    read() {
      return text.trim();
    },
  };
};

const withDetails = (message, details) => (details ? `${message}\n${details}` : message);

// Readiness is an actual HTTP round trip against the audited origin, polled
// until a bounded deadline, so startup can neither be guessed nor hang.
const waitForReady = async (child, context) => {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const spawnError = context.getSpawnError();

    if (spawnError) {
      throw new Error(`Could not start the local QA server: ${spawnError.message}`, {
        cause: spawnError,
      });
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        withDetails("The local QA server exited before it became ready.", context.readOutput()),
      );
    }

    try {
      const response = await fetch(`${BASE_URL}/`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });

      // Drain the body so the probe releases its socket before the audit runs.
      await response.arrayBuffer();

      return;
    } catch {}

    await delay(READY_INTERVAL_MS);
  }

  throw new Error(
    withDetails(
      `The local QA server did not answer on ${BASE_URL} within ${READY_TIMEOUT_MS} ms.`,
      context.readOutput(),
    ),
  );
};

/**
 * Starts the repository-local http-server on the fixed QA port and resolves
 * once it answers HTTP. The returned `stop` terminates only this child process
 * and is safe to call more than once, so callers can put it in a `finally`.
 */
export const startLocalQaServer = async ({ rootDir = process.cwd() } = {}) => {
  if (await isPortOccupied()) {
    throw new Error(
      `Port ${PORT} is already in use. The QA audits start their own server on that exact ` +
        `port because the audited URLs are fixed, and they never reuse or stop a process ` +
        `they do not own. Free ${BASE_URL} and run the command again.`,
    );
  }

  // npm's .bin shims are .cmd files on Windows, which node:child_process refuses
  // to spawn without a shell. Running the repository-local package entry point
  // with the current Node binary is what those shims do anyway, and it keeps the
  // server a direct child that cleanup can terminate on every platform.
  const serverEntry = path.join(rootDir, "node_modules", "http-server", "bin", "http-server");

  const child = spawn(
    process.execPath,
    [serverEntry, "-c-1", "-p", String(PORT), "--silent"],
    {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const output = createOutputCollector();
  output.attach(child.stdout);
  output.attach(child.stderr);

  let spawnError = null;
  child.once("error", (error) => {
    spawnError = error;
  });

  const exited = new Promise((resolve) => {
    child.once("close", resolve);
  });

  let stopping = null;

  const stop = () => {
    if (stopping) {
      return stopping;
    }

    stopping = (async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const forceTimer = setTimeout(() => child.kill("SIGKILL"), STOP_TIMEOUT_MS);
        child.kill();

        try {
          await exited;
        } finally {
          clearTimeout(forceTimer);
        }

        return;
      }

      await exited;
    })();

    return stopping;
  };

  try {
    await waitForReady(child, {
      getSpawnError: () => spawnError,
      readOutput: () => output.read(),
    });
  } catch (error) {
    await stop();
    throw error;
  }

  return { stop };
};
