// Test-only root CI launcher. The production entry always enables sandboxing.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  path = require("node:path");
app.enableSandbox = () => {};
app.setPath("userData", process.env.AEGIS_TEST_PROFILE);
const phase = process.env.AEGIS_RESTORE_PHASE;
const expectedFile = path.join(
  process.env.AEGIS_TEST_PROFILE,
  "expected-session.json",
);
const expected =
  phase === "read" ? JSON.parse(fs.readFileSync(expectedFile, "utf8")) : null;
require("../desktop/main.cjs");
const timeout = setTimeout(() => {
  console.error("Restore test timed out");
  app.exit(1);
}, 20000);
app.whenReady().then(async () => {
  let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');
  await new Promise(resolve=>{if(!win.webContents.isLoading())resolve();else win.webContents.once('did-finish-load',resolve);});await (async()=>{
    let server;
    try {
      const command = (name, arg) =>
        win.webContents.executeJavaScript(
          `window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`,
        );
      if (phase === "write") {
        server = http.createServer((req, res) => {
          if (req.url.startsWith("/frame"))
            res.end(
              '<script>history.replaceState(null,"","#child-change")</script>',
            );
          else
            res.end(
              '<title>Restore fixture</title><iframe src="/frame"></iframe><p>Fixture</p>',
            );
        });
        await new Promise((r) => server.listen(0, "127.0.0.1", r));
        const base = `http://127.0.0.1:${server.address().port}`;
        await command("navigate", base + "/one");
        await new Promise((r) => setTimeout(r, 400));
        let s = await command("state");
        const first = s.active;
        await command("new");
        await command("navigate", base + "/two");
        await new Promise((r) => setTimeout(r, 400));
        await command("new", true);
        await command("navigate", base + "/private-secret");
        await new Promise((r) => setTimeout(r, 400));
        await command("select", first);
        const prefs = JSON.parse(
          fs.readFileSync(
            path.join(app.getPath("userData"), "preferences.json"),
            "utf8",
          ),
        );
        assert.equal(prefs.savedSession.urls.length, 2);
        assert.deepEqual(
          prefs.savedSession.urls,
          [base + "/one", base + "/two"],
          "Child-frame navigation must not replace saved main-tab URLs",
        );
        assert(!JSON.stringify(prefs).includes("private-secret"));
        fs.writeFileSync(expectedFile, JSON.stringify(prefs.savedSession));
        console.log(
          "PASS restore write: two normal tabs saved, private URL excluded",
        );
      } else {
        let s;
        for (let i = 0; i < 60; i++) {
          s = await command("state");
          if (s.tabs.length === 2 && s.tabs.every((t) => t.url)) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        assert.deepEqual(
          s.tabs.map((t) => t.url),
          expected.urls,
        );
        assert.equal(s.active, s.tabs[expected.activeIndex].id);
        assert(s.tabs.every((t) => !t.private));
        console.log(
          "PASS restore read: normal tabs and active selection restored across process restart",
        );
      }
      clearTimeout(timeout);
      if (server) server.close();
      app.quit();
    } catch (e) {
      console.error(e);
      clearTimeout(timeout);
      if (server) server.close();
      app.exit(1);
    }
  })();
});
