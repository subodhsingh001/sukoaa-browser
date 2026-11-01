// Test-only sandbox override: root Linux CI; production sandbox remains enabled.
const {app, BrowserWindow, webContents, Menu} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
app.enableSandbox = () => {};
app.commandLine.appendSwitch('no-sandbox');
app.setPath('userData', fs.mkdtempSync('/tmp/aegis-developer-'));
let lastMenu;
const build = Menu.buildFromTemplate;
Menu.buildFromTemplate = template => { lastMenu = template; const menu = build(template); menu.popup = () => {}; return menu; };
require('../desktop/main.cjs');
const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(test, label) { for(let n=0;n<80;n++){if(await test())return;await pause(100);}throw Error('Timed out: '+label); }
const timeout = setTimeout(()=>{console.error('Developer test timeout');app.exit(1)},30000);
app.whenReady().then(async()=>{
 let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');
 await new Promise(resolve=>{if(!win.webContents.isLoading())resolve();else win.webContents.once('did-finish-load',resolve);});await (async()=>{
  let server;
  try {
   const command=(name,arg)=>win.webContents.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
   await until(async()=>(await command('state')).tabs.length,'initial tab');
   server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><title>Developer fixture</title><div id="player"><button id="full" onclick="document.getElementById(\'player\').requestFullscreen()">Fullscreen</button><p id="target">Inspect this element</p><input value="edit"></div>');});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const url=`http://127.0.0.1:${server.address().port}/`;
   await command('navigate',url);
   await until(()=>webContents.getAllWebContents().some(w=>w.getURL()===url&&!w.isLoading()),'fixture');
   const page=webContents.getAllWebContents().find(w=>w.getURL()===url);
   const pageView=()=>win.contentView.children.find(v=>v.webContents===page);
   assert.equal(pageView().getBounds().y,86);
   await page.executeJavaScript('document.getElementById("full").click()',true);
   await until(()=>page.executeJavaScript('!!document.fullscreenElement'),'HTML fullscreen');
   await until(()=>pageView().getBounds().y===0,'full window video bounds');
   assert.equal(pageView().getBounds().height,win.getContentSize()[1]);
   assert.equal(await page.executeJavaScript('navigator.mediaDevices.getUserMedia({audio:true}).then(()=>true,()=>false)'), false);
   await page.executeJavaScript('document.exitFullscreen()');
   await until(()=>pageView().getBounds().y===86,'restored chrome');
   await command('devtools');
   await until(()=>page.isDevToolsOpened(),'DevTools opening');
   await command('devtools');
   await until(()=>!page.isDevToolsOpened(),'DevTools closing');
   await pause(250);
   page.emit('context-menu',{}, {x:25,y:65,selectionText:'',isEditable:false,linkURL:'',editFlags:{}});
   const inspect=lastMenu.find(i=>i.label==='Inspect element');
   assert(inspect,'native context menu has Inspect element');inspect.click();
   await until(()=>page.isDevToolsOpened(),'Inspect opens DevTools');
   await until(()=>page.devToolsWebContents&&!page.devToolsWebContents.isLoading(),'DevTools frontend loaded');
   const toolsURL=page.devToolsWebContents.getURL();assert(toolsURL.startsWith('devtools://'));
   page.closeDevTools();
   await pause(250);
   for(const [preset,width] of [['phone',390],['compact',360],['tablet',768]]) {
    await command('device',preset);

    await until(async()=>Math.round(await page.executeJavaScript('innerWidth'))===width,preset+' CSS viewport');
    assert.equal((await command('state')).tabs[0].device,preset);
   }
   await command('device','phone');
   await command('new');
   const newState = await command('state');
   assert.equal(newState.tabs.find(t => t.id === newState.active).device, 'desktop');
   const tabs=(await command('state')).tabs;
   await command('select',tabs[0].id);
   await until(async()=>(await page.executeJavaScript('innerWidth'))===390,'per-tab emulation restored');
   await command('device','desktop');
   assert.equal(pageView().getBounds().y,86);
   await until(async()=>Math.round(await page.executeJavaScript('innerWidth'))===pageView().getBounds().width,'desktop resize committed');
   // F12 from a page reaches this page's tools, not the shell.
   page.emit('before-input-event',{preventDefault(){}},{type:'keyDown',key:'F12'});
   await until(()=>page.isDevToolsOpened(),'F12 opens page tools');
   page.closeDevTools();
   console.log('PASS: real gesture Fullscreen API, full-window bounds, exit restores chrome, media denied, DevTools toggle, context-menu Inspect, F12, three responsive CSS viewports, per-tab emulation and desktop reset');
   clearTimeout(timeout);server.close();app.exit(0);
  }catch(error){console.error(error);clearTimeout(timeout);server?.close();app.exit(1);}
 })();
});
