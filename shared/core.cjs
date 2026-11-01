// SPDX-License-Identifier: GPL-3.0-or-later
const searches = {
  google: "https://www.google.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  bing: "https://www.bing.com/search?q=",
};
function navigate(input, engine = "google") {
  const text = String(input || "")
    .trim()
    .slice(0, 8192);
  if (!text) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:/i.test(text))
    throw Error("Only HTTP and HTTPS websites are allowed");
  if (/^https?:\/\//i.test(text)) {
    const u = new URL(text);
    if (u.username || u.password)
      throw Error("Credentials in addresses are blocked");
    return u.href;
  }
  if (
    !/\s/.test(text) &&
    (/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(text) ||
      /^localhost([/:]|$)/.test(text))
  )
    return navigate("https://" + text, engine);
  return (searches[engine] || searches.google) + encodeURIComponent(text);
}
function host(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
const cosmetic =
  '[data-ad-slot],ins.adsbygoogle,iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],.google-auto-placed,.ad-container,.advertisement,[aria-label="Advertisement"]{display:none!important}';
const distractions =
  'ytd-rich-section-renderer:has(a[href^="/shorts/"]),ytd-reel-shelf-renderer,ytm-reel-shelf-renderer,a[href^="/shorts/"],#related,ytm-watch-next-secondary-results-renderer{display:none!important}';
function isYouTube(url) {
  const h = host(url);
  return h === "youtube.com" || h.endsWith(".youtube.com");
}
function safeSession(value) {
  if (!value || !Array.isArray(value.urls)) return { urls: [], activeIndex: 0 };
  const urls = value.urls
    .slice(0, 40)
    .filter((url) => url === null || typeof url === "string")
    .map((url) => {
      if (url === null) return null;
      try {
        const u = new URL(url);
        return /^https?:$/.test(u.protocol) && !u.username && !u.password
          ? u.href
          : null;
      } catch {
        return null;
      }
    });
  const activeIndex = Number.isInteger(value.activeIndex)
    ? Math.max(0, Math.min(urls.length - 1, value.activeIndex))
    : 0;
  return { urls, activeIndex: Math.max(0, activeIndex) };
}
function sessionFromTabs(tabs, activeId) {
  const regular = tabs.filter((t) => !t.private);
  return safeSession({
    urls: regular.map((t) => (/^https?:/.test(t.url) ? t.url : null)),
    activeIndex: Math.max(
      0,
      regular.findIndex((t) => t.id === activeId),
    ),
  });
}
module.exports = {
  navigate,
  host,
  cosmetic,
  distractions,
  searches,
  isYouTube,
  safeSession,
  sessionFromTabs,
};
