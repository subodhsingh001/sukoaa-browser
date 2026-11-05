// SPDX-License-Identifier: GPL-3.0-or-later
// Test-only root/container launcher. Production retains app.enableSandbox().
const {app,BrowserWindow,webContents}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),https=require('node:https'),assert=require('node:assert/strict');
app.enableSandbox=()=>{};
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('host-resolver-rules','MAP www.youtube.com 127.0.0.1');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sukoaa-focus-media-'));app.setPath('userData',profile);
const key=path.join(profile,'fixture.key'),cert=path.join(profile,'fixture.pem');
require('node:child_process').execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=www.youtube.com'],{stdio:'ignore'});
app.on('certificate-error',(event,_wc,url,_error,_cert,callback)=>{if(new URL(url).hostname==='www.youtube.com'){event.preventDefault();callback(true);}else callback(false);});
require('../desktop/main.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<600;i++){if(await fn())return;await wait(20);}throw Error('Timeout: '+label);}
const timeout=setTimeout(()=>{console.error('Focus/media smoke timeout');app.exit(1);},90000);
const wav=Buffer.alloc(44+44100*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let n=0;n<44100;n++)wav.writeInt16LE(Math.sin(n*2*Math.PI*440/44100)*9000,44+n*2);
app.whenReady().then(async()=>{
 let server;
 try {
  let win;await until(()=>{win=BrowserWindow.getAllWindows()[0];return !!win;},'window');
  const shell=win.webContents;await until(()=>!shell.isLoading(),'shell');
  const js=code=>shell.executeJavaScript(code),command=(name,arg)=>js(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  await until(async()=>!!(await command('state')).active,'initial tab');win.show();win.focus();shell.focus();
  shell.debugger.attach('1.3');
  async function click(selector){const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});}
  for(const selector of ['#new','#private']){
   const previous=(await command('state')).active;await click(selector);
   await until(async()=>{const s=await command('state');return s.active!==previous;},selector+' created');
   await until(()=>js('document.activeElement===document.querySelector("#address")'),'address focused');
   await shell.debugger.sendCommand('Input.insertText',{text:'typed-immediately'});
   await wait(400);
   assert.equal(await js('document.activeElement.id'),'address');assert.equal(await js('document.querySelector("#address").value'),'typed-immediately');
   assert(shell.isFocused(),'Native keyboard focus belongs to browser chrome: '+JSON.stringify({window:win.isFocused(),focused:webContents.getFocusedWebContents()?.getURL(),selector}));
   const home=win.contentView.children.find(view=>view.webContents && view.webContents!==shell)?.webContents;
   assert(home,'Active native home view');home.focus();
   await until(()=>shell.isFocused(),'address reclaims a late native home focus');
   assert.equal(await js('document.querySelector("#address").value'),'typed-immediately');
   const point=await home.executeJavaScript(`(()=>{const r=document.querySelector('.search input').getBoundingClientRect();return {x:Math.round(r.x+20),y:Math.round(r.y+r.height/2)}})()`);
   home.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});home.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
   await until(()=>home.executeJavaScript("document.activeElement.matches('.search input')"),'trusted page input click');
   home.focus();await wait(100);assert(home.isFocused(),'Page click cancels address focus ownership');
  }
  console.log('PASS actual New tab and Private button clicks keep native address focus and typed draft after home finishes');
  await js("window.tabActionCalls=[];window.realCommand=command;command=async(name,arg)=>{if(name==='tabMenu'){tabActionCalls.push(arg);return;}return realCommand(name,arg);};true");
  const tabSelector='.tab.active [role=tab]';
  const tabPoint=await js(`(()=>{const r=document.querySelector('${tabSelector}').getBoundingClientRect();return {x:r.x+25,y:r.y+r.height/2}})()`);
  await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...tabPoint,button:'left',clickCount:1});await wait(700);
  await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...tabPoint,button:'left',clickCount:1});
  assert.equal(await js('tabActionCalls.length'),1,'Holding a tab opens its actions once');
  await js("document.querySelector('.tab.active [role=tab]').focus()");
  await shell.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'F10',code:'F10',modifiers:8,windowsVirtualKeyCode:121});
  await shell.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'F10',code:'F10',modifiers:8,windowsVirtualKeyCode:121});
  await until(()=>js('tabActionCalls.length===2'),'keyboard tab menu');
  await js("document.querySelector('.tab.active').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))");
  assert.equal(await js('tabActionCalls.length'),3,'Right-click opens tab actions');
  await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...tabPoint,button:'left',clickCount:1});
  await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...tabPoint,button:'left',clickCount:1});await wait(700);
  assert.equal(await js('tabActionCalls.length'),3,'A short click must not trigger the hold menu');
  await js('command=window.realCommand;true');
  console.log('PASS tab long-press, right-click, Shift+F10 and short-click cancellation');

  server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(req,res)=>{
   if(req.url==='/tone.wav'){res.setHeader('Content-Type','audio/wav');res.end(wav);return;}
   res.setHeader('Content-Type','text/html');
   res.end(`<title>First-load media fixture</title><script>window.earlyInstalled=!!window.__sukoaaEarlyYouTube;window.ytInitialPlayerResponse={videoDetails:{videoId:'content'},streamingData:{formats:[{id:1}]},playabilityStatus:{status:'OK'},playerAds:[{}],adPlacements:[{}],adSlots:[{}]};window.firstAdCount=(ytInitialPlayerResponse.adPlacements||[]).length;</script><button id="play" onclick="document.querySelector('audio').play().then(()=>window.played=true).catch(e=>window.playError=e.name)">Play</button><audio loop autoplay src="/tone.wav"></audio><script>document.querySelector('audio').play().catch(e=>window.autoError=e.name);</script>`);
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
  const origin=`https://www.youtube.com:${port}`;
  await Promise.all(webContents.getAllWebContents().map(w=>w.session.setProxy({mode:'direct'})));
  await command('navigate',origin+'/first');
  let page;await until(()=>{page=webContents.getAllWebContents().find(w=>w.getURL()===origin+'/first');return page&&!page.isLoading();},'first fixture');
  assert.equal(await page.executeJavaScript('earlyInstalled'),true,'Installed before the first inline script');
  assert.equal(await page.executeJavaScript('firstAdCount'),0);
  assert.equal(await page.executeJavaScript('ytInitialPlayerResponse.videoDetails.videoId'),'content');
  assert.equal(await page.executeJavaScript('typeof window.aegis+","+typeof require+","+typeof window.ipcRenderer'),'undefined,undefined,undefined');
  assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),true);
  assert(page.isAudioMuted());
  const firstId=(await command('state')).active;
  page.sendInputEvent({type:'mouseDown',x:25,y:18,button:'left',clickCount:1});page.sendInputEvent({type:'mouseUp',x:25,y:18,button:'left',clickCount:1});
  await until(()=>page.executeJavaScript('window.played===true'),'trusted Play click');assert.equal(page.isAudioMuted(),false);
  await command('new');await command('navigate',origin+'/second');
  let second;await until(()=>{second=webContents.getAllWebContents().find(w=>w.getURL()===origin+'/second');return second&&!second.isLoading();},'second fixture');
  await wait(300);assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),false,'Started first tab continues while the second tab opens');assert.equal(page.isAudioMuted(),false);
  assert.equal(await second.executeJavaScript('document.querySelector("audio").paused'),true);
  const secondId=(await command('state')).active;
  second.sendInputEvent({type:'mouseDown',x:25,y:18,button:'left',clickCount:1});second.sendInputEvent({type:'mouseUp',x:25,y:18,button:'left',clickCount:1});
  await until(()=>second.executeJavaScript('window.played===true'),'second Play click');assert.equal(second.isAudioMuted(),false);assert.equal(page.isAudioMuted(),false,'Starting another tab does not revoke the first user activation');
  await command('select',firstId);await wait(300);assert.equal(await second.executeJavaScript('document.querySelector("audio").paused'),false);assert.equal(second.isAudioMuted(),false);
  await page.executeJavaScript('document.querySelector("audio").pause()');await command('select',secondId);await command('select',firstId);await wait(100);
  assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),true,'Manual pause persists across switching');

  await command('select',secondId);await command('muteTab',secondId);assert.equal((await command('state')).tabs.find(t=>t.id===secondId).muted,true);
  console.log('PASS first inline YouTube player data filtered; content preserved; site has no privileged API; no initial autoplay; trusted playback works; started media continues in background; manual pause remains paused; user mute retained');
  // Disabling YouTube protection must bypass the early hook after reload.
  await command('settings',{youtubeProtection:false});await until(()=>!second.isLoading(),'disabled reload');
  assert.equal(await second.executeJavaScript('earlyInstalled'),false);assert.equal(await second.executeJavaScript('firstAdCount'),1);
  console.log('PASS YouTube protection off bypasses first-load player filtering');
  shell.debugger.detach();server.close();clearTimeout(timeout);app.exit(0);
 }catch(error){console.error(error);server?.close();clearTimeout(timeout);app.exit(1);}
});
