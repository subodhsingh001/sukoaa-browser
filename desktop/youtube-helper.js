// SPDX-License-Identifier: GPL-3.0-or-later
// Runs only in the YouTube page sandbox; exposes no browser or Node APIs.
(() => {
  if (
    !(
      location.hostname === "youtube.com" ||
      location.hostname.endsWith(".youtube.com")
    ) ||
    globalThis.__aegisSkipHelper
  )
    return;
  globalThis.__aegisSkipHelper = true;
  let pending = false;
  const skip = () => {
    pending = false;
    const player = document.querySelector("#movie_player,.html5-video-player");
    if (!player) return;
    for (const button of player.querySelectorAll(
      "button.ytp-skip-ad-button,button.ytp-ad-skip-button-modern,button.ytp-ad-skip-button",
    )) {
      const bounds = button.getBoundingClientRect();
      if (!button.disabled && bounds.width > 0 && bounds.height > 0) {
        button.click();
        break;
      }
    }
  };
  const observer = new MutationObserver(() => {
    if (!pending) {
      pending = true;
      setTimeout(skip, 150);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "disabled", "style"],
  });
  skip();
  const style = document.createElement("style");
  style.textContent =
    "ytd-ad-slot-renderer,ytd-display-ad-renderer,ytd-promoted-sparkles-web-renderer,ytd-in-feed-ad-layout-renderer{display:none!important}";
  (document.head || document.documentElement).append(style);
  addEventListener("pagehide", () => observer.disconnect(), { once: true });
})();
