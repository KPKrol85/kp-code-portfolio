(function () {
  var root = document.documentElement;
  var theme = root.getAttribute("data-theme");

  if (theme !== "light" && theme !== "dark") {
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }

  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#181210" : "#f8f1e7");

  if ("serviceWorker" in navigator) {
    var hostname = window.location.hostname;
    var isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    var logWarn = function () {
      if (isLocalhost) {
        console.warn.apply(console, arguments);
      }
    };

    if (!isLocalhost) {
      window.addEventListener("load", function () {
        navigator.serviceWorker
          .register("/sw.js")
          .then(function () {
          })
          .catch(function (err) {
            logWarn("❌ Błąd rejestracji Service Workera:", err);
          });
      });
    }
  }
})();
