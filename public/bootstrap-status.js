// This independent script keeps the HTML useful if the application bundle fails.
function showStartupHelp() {
  const help = document.getElementById("startup-help");
  if (help) help.hidden = false;
}
window.addEventListener("error", showStartupHelp, true);
window.addEventListener("unhandledrejection", showStartupHelp);
setTimeout(showStartupHelp, 8000);
