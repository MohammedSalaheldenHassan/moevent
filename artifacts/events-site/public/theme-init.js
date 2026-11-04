// Apply the saved or system theme before first paint (no light flash).
// Keep in sync with src/lib/theme.ts.
(function () {
  var t = null;
  try { t = localStorage.getItem("moevent-site-theme"); } catch (e) {}
  if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  if (t === "dark") document.querySelector('meta[name="theme-color"]').setAttribute("content", "#171716");
})();
