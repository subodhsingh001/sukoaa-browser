// Local CI harness only: Linux root containers cannot use the production OS sandbox.
const { app, BrowserWindow, webContents } = require("electron");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
app.enableSandbox = () => {};
app.setPath("userData", fs.mkdtempSync("/tmp/aegis-smoke-"));
require("../desktop/main.cjs");
const limit = setTimeout(() => {
  console.error("FAIL smoke timed out");
  app.exit(1);
}, 25000);
app.whenReady().then(async () => {
  let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');
  await new Promise(resolve=>{if(!win.webContents.isLoading())resolve();else win.webContents.once('did-finish-load',resolve);});await (async()=>{
    let server;
    try {
      const command = (name, arg) =>
        win.webContents.executeJavaScript(
          `window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`,
        );
      let s = await command("state");
      assert.equal(s.tabs.length, 1);
      await command("new", true);
      s = await command("state");
      assert.equal(s.tabs.length, 2);
      assert(s.tabs[1].private);
      await command("close", s.active);
      s = await command("state");
      assert.equal(s.tabs.length, 1);
      for (
        let i = 0;
        i < 50 &&
        !webContents
          .getAllWebContents()
          .some((w) => w.getURL().endsWith("/home.html"));
        i++
      )
        await new Promise((resolve) => setTimeout(resolve, 50));
      const page = webContents
        .getAllWebContents()
        .find((w) => w.getURL().endsWith("/home.html"));
      assert(page, "Home page loaded");
      await command("panel", true);
      await win.webContents.executeJavaScript(
        "document.getElementById('panel').hidden=false",
      );
      await command("panel", false);
      server = http.createServer((req, res) => {
        res.setHeader("Content-Type", "text/html");
        res.end(
          '<title>Fixture page</title><script src="http://pagead2.googlesyndication.com/ads.js"></script><p id="ok">Page remains usable</p>',
        );
      });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      await command("navigate", `http://127.0.0.1:${server.address().port}/`);
      await new Promise((r) => setTimeout(r, 1500));
      s = await command("state");
      assert(s.total >= 1, "Advertising request blocked");
      assert(s.tabs[0].url.startsWith("http://127.0.0.1"));
      const titleBeforeTheme = s.tabs[0].title;
      await command("settings", { theme: "light" });
      s = await command("state");
      assert.equal(s.settings.theme, "light");
      assert.equal(
        s.tabs[0].title,
        titleBeforeTheme,
        "Theme updates preserve the loaded page",
      );
      assert.equal(
        s.tabs[0].loading,
        false,
        "Theme updates do not reload websites",
      );
      await command("settings", { theme: "dark" });
      await command("bookmark");
      s = await command("state");
      assert.equal(s.settings.bookmarks.length, 1);
      await command("shield");
      s = await command("state");
      assert(s.settings.exceptions.includes("127.0.0.1"));
      const normalSession = webContents
        .getAllWebContents()
        .find((w) => w.getURL().startsWith("http://127.0.0.1")).session;
      await normalSession.cookies.set({
        url: `http://127.0.0.1:${server.address().port}/`,
        name: "keepCookie",
        value: "yes",
      });
      await command("clear", { history: true, cache: true });
      s = await command("state");
      assert.equal(s.settings.history.length, 0);
      assert(
        (await normalSession.cookies.get({ name: "keepCookie" })).length === 1,
        "History/cache clearing keeps cookies",
      );
      await command("clear", { cookies: true, session: true });
      await new Promise((resolve) => setTimeout(resolve, 700));
      s = await command("state");
      assert.equal(
        s.settings.history.length,
        0,
        "Internal reload does not recreate cleared history",
      );
      assert.equal(s.settings.restoreSession, false);
      assert.deepEqual(s.settings.savedSession, { urls: [], activeIndex: 0 });
      assert.equal(
        (await normalSession.cookies.get({ name: "keepCookie" })).length,
        0,
      );
      const preferences = webContents
        .getAllWebContents()
        .filter((w) => w.getType() === "window")
        .map((w) => w.getLastWebPreferences());
      assert(
        preferences.every(
          (p) => p.nodeIntegration === false && p.contextIsolation && p.sandbox,
        ),
      );
      console.log(
        "PASS: launch, home, tabs, private session, panel visibility, actual request blocking, bookmarks, per-site exception, sandbox preferences, granular clear controls",
      );
      clearTimeout(limit);
      server.close();
      app.exit(0);
    } catch (e) {
      console.error(e);
      clearTimeout(limit);
      if (server) server.close();
      app.exit(1);
    }
  })();
});
