// Root Linux CI only; production source keeps sandbox enabled.
const {app,BrowserWindow,webContents,dialog} = require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
app.enableSandbox=()=>{};
app.setPath('userData',fs.mkdtempSync('/tmp/aegis-features-'));
const extension=fs.mkdtempSync('/tmp/aegis-test-extension-');
fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify({manifest_version:3,name:'Aegis test marker',version:'1.0',host_permissions:['http://127.0.0.1/*'],content_scripts:[{matches:['http://127.0.0.1/*'],js:['marker.js'],run_at:'document_end'}]}));
fs.writeFileSync(path.join(extension,'marker.js'),'document.documentElement.setAttribute("data-aegis-test-extension","ready");');
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[extension]});
let review=1;
dialog.showMessageBox=async()=>({response:review});
require('../desktop/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await pause(50);}throw Error('Timeout: '+label);}
const timer=setTimeout(()=>{console.error('Feature test timeout');app.exit(1)},35000);
app.whenReady().then(async()=>{
 let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');
 await new Promise(resolve=>{if(!win.webContents.isLoading())resolve();else win.webContents.once('did-finish-load',resolve);});await (async()=>{
 let server;
 try{
  const command=(name,arg)=>win.webContents.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  await until(async()=>(await command('state')).tabs.length===1,'startup');
  let imageHits=0,assetHits=0;
  server=http.createServer((req,res)=>{
   if(req.url==='/picture.png'){imageHits++;res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a4ZQAAAAASUVORK5CYII=','base64'));return;}
   if(req.url==='/asset.js'){assetHits++;res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','public,max-age=86400');res.end('window.assetReady=true');return;}
   res.setHeader('Content-Type','text/html');res.end('<title>Feature fixture</title><meta name="viewport" content="width=device-width"><img src="/picture.png"><script src="/asset.js"></script><p>Fixture</p>');
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/`;
  await command('navigate',url);
  await until(()=>webContents.getAllWebContents().some(w=>w.getURL()===url&&!w.isLoading()),'normal page');
  const normal=webContents.getAllWebContents().find(w=>w.getURL()===url);
  await normal.executeJavaScript('document.cookie="normalOnly=yes";localStorage.setItem("normalOnly","yes")');
  const baseImages=imageHits;
  await command('lite');await until(()=>!normal.isLoading(),'Lite reload');await pause(200);
  assert.equal(imageHits,baseImages,'Lite mode stops actual image request');
  assert((await command('state')).tabs[0].liteBlocked>=1);
  const oldAssets=assetHits;await command('hardReload');await until(()=>!normal.isLoading(),'hard reload');await pause(200);
  assert(assetHits>oldAssets,'Hard reload fetched cacheable asset again');
  review=0;await command('extensionInstall');assert.equal((await command('state')).extensions.length,0,'cancel does not install');
  review=1;let response=await command('extensionInstall');assert(!response.error,response.error);
  let state=await command('state');assert.equal(state.extensions.length,1);const extensionID=state.extensions[0].id;
  normal.reload();await until(async()=>!normal.isLoading()&&(await normal.executeJavaScript('document.documentElement.getAttribute("data-aegis-test-extension")'))==='ready','actual extension content script');
  const historyBeforePrivate=(await command('state')).settings.history.length;
  await command('cleanTest');
  await until(async()=>(await command('state')).tabs.some(t=>t.private&&!t.loading&&t.url===url),'clean private page');
  const privatePage=webContents.getAllWebContents().find(w=>w.getURL()===url&&w!==normal);
  assert(privatePage);assert.notEqual(privatePage.session,normal.session);assert.equal(privatePage.session.isPersistent(),false);
  assert.equal(await privatePage.executeJavaScript('document.cookie.includes("normalOnly")'),false);
  assert.equal(await privatePage.executeJavaScript('localStorage.getItem("normalOnly")'),null);
  assert.equal(await privatePage.executeJavaScript('document.documentElement.getAttribute("data-aegis-test-extension")'),null,'extensions excluded from private session');
  assert.equal(privatePage.session.extensions.getAllExtensions().length,0);
  const beforePrivateAsset=assetHits;privatePage.reload();await until(()=>!privatePage.isLoading(),'private reload');await pause(200);
  assert(assetHits>beforePrivateAsset,'Private HTTP cache disabled');
  state=await command('state');assert.equal(state.settings.history.length,historyBeforePrivate,'Private browsing does not add history');const privateId=state.active;
  assert.equal(state.settings.savedSession.urls.length,1,"Private tabs are excluded from saved session");
  await privatePage.executeJavaScript('localStorage.setItem("privateSecret","value")');
  const privateSession=privatePage.session;
  await command('close',privateId);
  assert.deepEqual(await privateSession.cookies.get({}),[],'Private storage erased on close');
  await command('cleanTest');await until(async()=>(await command('state')).tabs.some(t=>t.private&&!t.loading),'second private');
  const second=webContents.getAllWebContents().find(w=>w.getURL()===url&&w!==normal);
  assert.equal(await second.executeJavaScript('localStorage.getItem("privateSecret")'),null);
  await command('extensionRemove',extensionID);assert.equal((await command('state')).extensions.length,0);
  assert.equal(normal.session.extensions.getAllExtensions().length,0);
  await win.webContents.executeJavaScript(`document.querySelector('[data-view="tools"]').click(); document.getElementById('menu').click()`);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[data-page="tools"]').hidden`),false);
  assert.equal(await win.webContents.executeJavaScript(`document.getElementById('private').textContent.includes('Private')`),true);
  assert.equal(await win.webContents.executeJavaScript(`document.documentElement.scrollWidth > innerWidth`),false);
  await command('panel',false);
  win.setContentSize(720,600);await pause(150);
  const geometry=await win.webContents.executeJavaScript(`(() => {
    const rect=id=>document.querySelector(id).getBoundingClientRect();
    return {header:rect('header').height, toolbarBottom:rect('.toolbar').bottom,
      privateRight:rect('#private').right, width:innerWidth,
      controls:['#developer','#mobilePreview','#menu','#address'].map(id=>({width:rect(id).width,left:rect(id).left,right:rect(id).right})),
      overflow:document.documentElement.scrollWidth>innerWidth,
      statusHeight:rect('#status').height};
  })()`);
  assert.equal(geometry.header,86,'exactly two chrome rows');
  assert.equal(geometry.toolbarBottom,86);
  assert(geometry.privateRight<=geometry.width-146,'tabs leave space for native window controls');
  assert(geometry.controls.every(r=>r.width>0&&r.left>=0&&r.right<=geometry.width),'navigation and developer controls fit at minimum width');
  assert.equal(geometry.overflow,false);
  assert.equal(geometry.statusHeight,1,'accessible status does not take a row');
  assert.equal(win.contentView.children.find(v=>v.webContents===second).getBounds().y,86,'webpage starts directly below toolbar');
  fs.writeFileSync('/tmp/aegis-compact-ui.png',(await win.webContents.capturePage()).toPNG());
  console.log('PASS: two-row chrome, viewport geometry, tools UI, private label, startup, private cookie/localStorage isolation, HTTP cache disabled, erase on close, clean test, cache bypass, Lite network blocking, extension permission cancel, real MV3 injection, private extension exclusion and removal');
  clearTimeout(timer);server.close();app.exit(0);
 }catch(error){console.error(error);clearTimeout(timer);server?.close();app.exit(1);}
 })();
});
