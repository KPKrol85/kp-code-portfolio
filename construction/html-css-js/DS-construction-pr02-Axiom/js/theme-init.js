(function () {
  var root = document.documentElement;
  root.classList.add("js");
  try {
    var mode = "light";
    var saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") mode = saved;
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) mode = "dark";
    root.setAttribute("data-theme", mode);
  } catch (e) {}
})();
