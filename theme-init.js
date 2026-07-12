// Runs in <head> before first paint so the page never flashes the wrong
// theme. Stored preference wins; otherwise follow the OS setting.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("chiTheme");
  } catch (error) {
    stored = null;
  }
  var dark = stored
    ? stored === "dark"
    : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
