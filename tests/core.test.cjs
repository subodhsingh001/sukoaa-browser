const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { navigate, host } = require("../shared/core.cjs");
const {
  FiltersEngine,
  Request,
} = require("../desktop/node_modules/@ghostery/adblocker");
const lists = ["easylist.txt", "easyprivacy.txt"]
  .map((f) => fs.readFileSync(path.join(__dirname, "../shared", f), "utf8"))
  .join("\n");
const engine = FiltersEngine.parse(lists);
test("searches, addresses and encoded query", () => {
  assert.equal(navigate("example.com/path"), "https://example.com/path");
  assert.equal(
    navigate("hello & world"),
    "https://www.google.com/search?q=hello%20%26%20world",
  );
  assert.equal(
    navigate("test", "duckduckgo"),
    "https://duckduckgo.com/?q=test",
  );
  assert.equal(navigate(""), null);
});
test("rejects local and executable schemes and credential URLs", () => {
  for (const u of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,hi",
    "https://user:pass@example.com",
  ])
    assert.throws(() => navigate(u));
});
test("host boundary is not URL substring", () => {
  assert.equal(
    host("https://safe.example/?next=https://ads.bad"),
    "safe.example",
  );
});
test("real bundled lists block advertising requests", () => {
  assert.equal(
    engine.match(
      Request.fromRawDetails({
        url: "https://googleads.g.doubleclick.net/pagead/ads",
        sourceUrl: "https://example.org",
        type: "script",
      }),
    ).match,
    true,
  );
});
test("real bundled lists leave ordinary page resources usable", () => {
  assert.equal(
    engine.match(
      Request.fromRawDetails({
        url: "https://example.org/style.css",
        sourceUrl: "https://example.org",
        type: "stylesheet",
      }),
    ).match,
    false,
  );
});
test("filter exception takes precedence", () => {
  const e = FiltersEngine.parse(
    "||ads.example^\n@@||ads.example/allowed.js$script",
  );
  assert.equal(
    e.match(
      Request.fromRawDetails({
        url: "https://ads.example/allowed.js",
        sourceUrl: "https://website.example",
        type: "script",
      }),
    ).match,
    false,
  );
});
test("strict domain matching on Android extraction", () => {
  const domains = new Set(
    fs
      .readFileSync(path.join(__dirname, "../shared/domains.txt"), "utf8")
      .trim()
      .split("\n"),
  );
  assert(domains.size > 50000);
  assert(domains.has("pagead2.googlesyndication.com"));
  assert(!domains.has("youtube.com"));
  assert(!domains.has("google.com"));
});

test("session snapshots exclude private tabs and preserve active normal tab", () => {
  const { sessionFromTabs } = require("../shared/core.cjs");
  const saved = sessionFromTabs(
    [
      { id: "one", url: "https://example.com/one", private: false },
      {
        id: "secret",
        url: "https://example.com/private-secret",
        private: true,
      },
      { id: "two", url: "https://example.com/two", private: false },
    ],
    "two",
  );
  assert.deepEqual(saved, {
    urls: ["https://example.com/one", "https://example.com/two"],
    activeIndex: 1,
  });
  assert(!JSON.stringify(saved).includes("private-secret"));
});
test("restored session rejects executable, local and credential addresses", () => {
  const { safeSession } = require("../shared/core.cjs");
  assert.deepEqual(
    safeSession({
      urls: [
        "file:///etc/passwd",
        "javascript:alert(1)",
        "https://user:pass@example.com",
        "https://example.com",
      ],
      activeIndex: 99,
    }),
    { urls: [null, null, null, "https://example.com/"], activeIndex: 3 },
  );
});
test("YouTube policy has a hostname boundary and maintained scriptlets", () => {
  const { isYouTube } = require("../shared/core.cjs");
  assert(isYouTube("https://www.youtube.com/watch?v=one"));
  assert(!isYouTube("https://youtube.com.evil.example"));
  const e = FiltersEngine.parse(
    fs.readFileSync(
      path.join(__dirname, "../shared/ublock/filters.txt"),
      "utf8",
    ) +
      "\n" +
      fs.readFileSync(
        path.join(__dirname, "../shared/ublock/quick-fixes.txt"),
        "utf8",
      ),
  );
  e.updateResources(
    fs.readFileSync(
      path.join(__dirname, "../shared/ublock/resources.json"),
      "utf8",
    ),
    "test-resources",
  );
  const c = e.getCosmeticsFilters({
    url: "https://www.youtube.com/watch?v=fixture",
    hostname: "www.youtube.com",
    domain: "youtube.com",
    getInjectionRules: true,
    getExtendedRules: false,
  });
  assert(c.scripts.length > 0);
});
