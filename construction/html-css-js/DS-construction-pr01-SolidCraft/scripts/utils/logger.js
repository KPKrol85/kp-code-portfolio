const EOL = "\n";

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function isVerboseEnabled(argv = process.argv.slice(2), env = process.env) {
  return hasFlag(argv, "--verbose") || env.VERBOSE === "1";
}

function createLogger({
  argv = process.argv.slice(2),
  env = process.env,
} = {}) {
  const verbose = isVerboseEnabled(argv, env);

  function writeStdout(message) {
    process.stdout.write(`${message}${EOL}`);
  }

  function writeStderr(message) {
    process.stderr.write(`${message}${EOL}`);
  }

  return {
    verbose,
    log: writeStdout,
    summary: writeStdout,
    warn: writeStderr,
    error: writeStderr,
    debug: (message) => {
      if (verbose) {
        writeStdout(message);
      }
    },
  };
}

module.exports = {
  createLogger,
  isVerboseEnabled,
};
