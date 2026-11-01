// Synthetic player tests only. This does not certify live YouTube ad blocking.
const { chromium } = require("../desktop/node_modules/playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const {
  FiltersEngine,
} = require("../desktop/node_modules/@ghostery/adblocker");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.AEGIS_CHROME || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.route("https://www.youtube.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<div id="movie_player"><button class="ytp-skip-ad-button">Skip</button><button id="ordinary">Ordinary</button></div><ytd-ad-slot-renderer>Promoted</ytd-ad-slot-renderer><div id="content">Video content</div>',
      }),
    );
    await page.goto("https://www.youtube.com/watch?v=fixture");
    await page.evaluate(() => {
      window.skips = 0;
      window.ordinaryClicks = 0;
      document.querySelector(".ytp-skip-ad-button").onclick = () => {
        window.skips++;
      };
      document.querySelector("#ordinary").onclick = () =>
        window.ordinaryClicks++;
    });
    await page.evaluate(
      fs.readFileSync(
        path.join(__dirname, "../desktop/youtube-helper.js"),
        "utf8",
      ),
    );
    assert((await page.evaluate(() => window.skips)) >= 1);
    assert.equal(await page.evaluate(() => window.ordinaryClicks), 0);
    assert.equal(
      await page
        .locator("ytd-ad-slot-renderer")
        .evaluate((el) => getComputedStyle(el).display),
      "none",
    );
    assert(await page.locator("#content").isVisible());
    const e = FiltersEngine.parse(
      "www.youtube.com##+js(json-prune, playerAds adPlacements)",
    );
    e.updateResources(
      fs.readFileSync(
        path.join(__dirname, "../shared/ublock/resources.json"),
        "utf8",
      ),
      "fixture",
    );
    const result = e.getCosmeticsFilters({
      url: page.url(),
      hostname: "www.youtube.com",
      domain: "youtube.com",
      getInjectionRules: true,
      getExtendedRules: false,
    });
    assert(result.scripts.length > 0);
    for (const script of result.scripts) await page.evaluate(script);
    const clean = await page.evaluate(() =>
      JSON.parse(
        '{"playerAds":[1],"adPlacements":[2],"videoDetails":{"videoId":"kept"}}',
      ),
    );
    assert.equal(clean.playerAds, undefined);
    assert.equal(clean.adPlacements, undefined);
    assert.equal(clean.videoDetails.videoId, "kept");
    console.log(
      "PASS synthetic YouTube assistance: visible Skip clicked, unrelated button untouched, promoted card hidden, video content preserved, maintained JSON-prune scriptlet executed",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
