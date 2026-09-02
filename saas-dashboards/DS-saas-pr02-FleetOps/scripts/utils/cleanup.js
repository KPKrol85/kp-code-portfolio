// Registry for cleaning up global listeners/timers between route changes
const CleanupRegistry = (() => {
  const cleanups = [];

  const add = (fn) => {
    if (typeof fn === "function") cleanups.push(fn);
  };

  const runAll = () => {
    while (cleanups.length) {
      const fn = cleanups.pop();
      try {
        fn();
      } catch (err) {
        console.warn("Cleanup error", err);
      }
    }
    reset();
  };

  const reset = () => {
    cleanups.length = 0;
  };

  return {
    add, // register cleanup callback
    runAll, // execute and drain current cleanups
    reset, // drop any remaining callbacks without running
  };
})();

export { CleanupRegistry };
