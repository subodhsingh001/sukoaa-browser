// New-tab behaviours are real; the browser settings shell uses a mock state for layout checks.
const { chromium } = require("../desktop/node_modules/playwright");
const { pathToFileURL } = require("node:url");
const nodePath = require("node:path"),
  fs = require("node:fs"),
  os = require("node:os");
const path = nodePath.resolve(__dirname, "..");
const output = fs.mkdtempSync(nodePath.join(os.tmpdir(), "aegis-visual-"));
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.AEGIS_CHROME || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1360, height: 860 },
    colorScheme: "dark",
  });
  await page.goto(pathToFileURL(path + "/desktop/home.html").href);
  await page.waitForFunction(
    () => document.getElementById("clock").textContent.length > 2,
  );
  await page.screenshot({ path: nodePath.join(output, "aegis-home-dark.png") });
  await page.getByRole("button", { name: "Add shortcut" }).click();
  await page.locator("#linkName").fill("Workspace");
  await page.locator("#linkUrl").fill("https://example.com");
  await page.getByRole("button", { name: "Add shortcut", exact: true }).click();
  await page.getByRole("link", { name: "W Workspace" }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: "W Workspace" }).waitFor();
  await page.locator("#engine").selectOption("duckduckgo");
  if (
    (await page.locator("#search").getAttribute("action")) !==
    "https://duckduckgo.com/"
  )
    throw Error("Engine not changed");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: nodePath.join(output, "aegis-home-light.png"),
  });
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto(
    pathToFileURL(path + "/android/app/src/main/assets/home.html").href,
  );
  await page.screenshot({
    path: nodePath.join(output, "aegis-mobile-home.png"),
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile page overflows");
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    const data = {
      tabs: [
        {
          id: "one",
          title: "New tab",
          url: "",
          blocked: 0,
          loading: false,
          private: false,
          back: false,
          forward: false,
          error: "",
        },
      ],
      active: "one",
      total: 0,
      downloads: [],
      settings: {
        search: "google",
        theme: "dark",
        strict: false,
        focus: false,
        exceptions: [],
        bookmarks: [],
        history: [],
      },
    };
    window.aegis = {
      command: async (name, arg) => {
        if (name === "device") data.tabs[0].device = arg;
        if (name === "devtools") data.tabs[0].devtools = !data.tabs[0].devtools;
        return data;
      },
      onState: () => {},
      onFocus: () => {},
      onClosePanel: () => {},
    };
  });
  await page.goto(pathToFileURL(path + "/desktop/index.html").href);
  await page.locator("#menu").click();
  await page.locator("#panel:not([hidden])").waitFor();
  await page.screenshot({
    path: nodePath.join(output, "aegis-settings-dark.png"),
  });
  await page.locator("#clear").click();
  await page.locator("#clearDialog[open]").waitFor();
  if ((await page.locator("#clearForm input[type=checkbox]").count()) !== 4)
    throw Error("Missing data clearing choices");
  await page.locator("#cancelClear").click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.screenshot({
    path: nodePath.join(output, "aegis-appearance-dark.png"),
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: nodePath.join(output, "aegis-appearance-light.png"),
  });
  await page.locator("#dismiss").click();
  await page.locator("#mobilePreview").click();
  await page.locator("#deviceBar:not([hidden])").waitFor();
  await page.locator("#devicePreset").selectOption("tablet");
  if (await page.locator("#devicePreset").inputValue() !== "tablet") throw Error("Tablet control failed");
  await page.locator("#developer").click();
  if (await page.locator("#developer").getAttribute("aria-pressed") !== "true") throw Error("Inspect control failed");
  await page.screenshot({path: nodePath.join(output,"aegis-device-preview.png")});
  await page.setViewportSize({width:720,height:600});
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error("Device toolbar overflows minimum desktop width");
  await page.screenshot({path: nodePath.join(output,"aegis-device-compact.png")});
  await page.locator("#exitDevice").click();
  await page.locator("#deviceBar[hidden]").waitFor({state:"attached"});
  console.log("Visual output: " + output);
  console.log(
    "PASS: new-tab script CSP, custom shortcut save/reload, engine selection, mobile overflow, settings navigation, desktop theme renders, device preview controls, Inspect button, minimum-width developer toolbar",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
