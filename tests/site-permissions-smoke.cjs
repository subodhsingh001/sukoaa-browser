const {app,BrowserWindow,webContents,dialog}=require('electron');
const fs=require('fs'),http=require('http'),assert=require('assert/strict');
app.enableSandbox=()=>{};app.setPath('userData',fs.mkdtempSync('/tmp/sukoaa-permissions-'));
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
let answer=1,prompts=0;
dialog.showMessageBox=async(_win,options)=>{assert(options.title.includes('Site permission'));prompts++;return {response:answer};};
require('../desktop/main.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<300;i++){if(await fn())return;await sleep(20)}throw Error('timeout');};
const timer=setTimeout(()=>{console.error('smoke timeout');app.exit(1)},45000);
app.whenReady().then(async()=>{
 let server;
 try {
  let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');await until(()=>!win.webContents.isLoading());
  const cmd=(name,arg)=>win.webContents.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  server=http.createServer((_q,r)=>r.end('<title>Permission fixture</title><h1>Camera and microphone test</h1>'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`,origin=new URL(url).origin;
  await cmd('navigate',url);let page;await until(()=>{page=webContents.getAllWebContents().find(w=>w.getURL()===url);return page&&!page.isLoading()});
  const capture=()=>page.executeJavaScript(`navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(s=>{window.stream=s;return s.getTracks().map(t=>t.kind).sort()}).catch(e=>e.name)`,true);
  assert.deepEqual(await capture(),['audio','video']);assert.equal(prompts,1);
  let state=await cmd('state');assert.equal(state.permissions.sites[0].camera,'allow');assert.equal(state.settings.sitePermissions[origin].microphone,'allow');
  await win.webContents.executeJavaScript(`document.querySelector('#menu').click()`);await win.webContents.executeJavaScript(`document.querySelector('[data-view="permissions"]').click()`);
  assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[data-page="permissions"]').hidden`),false);
  await until(()=>win.webContents.executeJavaScript(`document.querySelectorAll('#permissionSites select').length===3`));
  await cmd('permissionSet',{origin,kind:'camera',value:'block'});await until(()=>!page.isLoading());assert.equal(await capture(),'NotAllowedError');assert.equal(prompts,1);
  const normalPage=page;await cmd('new',true);await cmd('panel',false);await cmd('navigate',url);await until(()=>{const pages=webContents.getAllWebContents().filter(w=>w.getURL()===url);page=pages.find(w=>w.id!==normalPage.id);return page&&!page.isLoading()});
  answer=0;assert.deepEqual(await capture(),['audio','video']);state=await cmd('state');assert(state.permissions.private);const privateId=state.active;
  assert.equal(state.settings.sitePermissions[origin].camera,'block');await cmd('close',privateId);await cmd('new',true);state=await cmd('state');assert.equal(state.permissions.sites.length,0);
  const existing=new Set(webContents.getAllWebContents().map(w=>w.id));await cmd('navigate',url);
  await until(()=>{page=webContents.getAllWebContents().find(w=>w.getURL()===url && w.id!==normalPage.id);return page&&!page.isLoading()});
  page.debugger.attach('1.3');await page.debugger.sendCommand('Emulation.setGeolocationOverride',{latitude:22.57,longitude:88.36,accuracy:10});
  const location=await page.executeJavaScript(`new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve(p.coords.latitude),e=>resolve(e.code),{timeout:3000}))`,true);
  assert.equal(location,22.57);page.debugger.detach();
  console.log('PASS: actual fake-device camera/microphone prompt, persistent decisions, UI controls, revocation reload, isolated private grants and cleanup, geolocation with simulated coordinates');
  clearTimeout(timer);server.close();app.exit(0);
 }catch(error){console.error(error);clearTimeout(timer);server?.close();app.exit(1);}
});
