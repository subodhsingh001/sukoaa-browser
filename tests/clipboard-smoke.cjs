// SPDX-License-Identifier: GPL-3.0-or-later
const {app,BrowserWindow,webContents,clipboard}=require('electron');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
app.enableSandbox=()=>{}; // Container test only; production still enables sandbox.
app.setPath('userData',fs.mkdtempSync('/tmp/sukoaa-clipboard-test-'));
require('../desktop/main.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<400;i++){if(await fn())return;await sleep(25)}throw Error('timeout');};
const timer=setTimeout(()=>{console.error('clipboard smoke timeout');app.exit(1)},60000);
app.whenReady().then(async()=>{
  let server;
  try {
    let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');await until(()=>!win.webContents.isLoading());
    const cmd=(name,arg)=>win.webContents.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
    server=http.createServer((_q,r)=>r.end(`<button id="copy" onclick="navigator.clipboard.writeText('Sukoaa website copy verified').then(()=>document.title='copied',e=>document.title=e.name)">Copy</button>`));
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const url=`http://127.0.0.1:${server.address().port}/`;
    const seen=new Set();
    for(const priv of [false,true]) {
      if(priv)await cmd('new',true);
      await cmd('navigate',url);let page;
      await until(()=>{page=webContents.getAllWebContents().find(w=>w.getURL()===url&&!seen.has(w.id));return page&&!page.isLoading()});seen.add(page.id);
      win.show();win.focus();page.focus();await until(()=>win.isFocused()&&page.isFocused());
      await clipboard.writeText('before');page.debugger.attach('1.3');
      await until(()=>page.executeJavaScript('document.hasFocus()'));
      await page.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const rect=await page.executeJavaScript(`(()=>{const r=document.querySelector('#copy').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await page.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',clickCount:1});
      await page.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',clickCount:1});
      await until(()=>{const title=page.getTitle();if(title==='NotAllowedError')throw Error('Copy permission unexpectedly denied');return title==='copied';});
      assert.equal(await clipboard.readText(),'Sukoaa website copy verified');
      const read=await page.executeJavaScript(`navigator.clipboard.readText().then(()=>'unexpected-read',e=>e.name)`,true);
      assert.equal(read,'NotAllowedError');page.debugger.detach();
      if(priv) {const state=await cmd('state');assert.equal(state.permissions.private,true);assert.equal(state.settings.sitePermissions?.[new URL(url).origin],undefined);}
    }
    console.log('PASS: real Copy button updates system clipboard in normal and private tabs; clipboard reading remains denied; no persistent clipboard grant');
    server.close();clearTimeout(timer);app.exit(0);
  }catch(e){console.error(e);server?.close();clearTimeout(timer);app.exit(1);}
});
