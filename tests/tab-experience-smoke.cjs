// SPDX-License-Identifier: GPL-3.0-or-later
const {app,BrowserWindow,webContents}=require('electron');
const fs=require('fs'),http=require('http'),assert=require('assert/strict');
app.enableSandbox=()=>{}; // Container test only; production sandbox stays enabled.
app.setPath('userData',fs.mkdtempSync('/tmp/sukoaa-tabs-test-'));
require('../desktop/main.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<500;i++){if(await fn())return;await sleep(20);}throw Error('timeout');};
const timeout=setTimeout(()=>{console.error('Tab smoke timeout');app.exit(1)},60000);
app.whenReady().then(async()=>{
 let server;
 try {
  let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');await until(()=>!win.webContents.isLoading());
  const shell=win.webContents,cmd=(name,arg)=>shell.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  let s;await until(async()=>{s=await cmd('state');return s.tabs.length});
  win.show();win.focus();
  await until(()=>shell.executeJavaScript(`document.activeElement.id==='address'`));
  await shell.insertText('typed without a click');await sleep(250);await cmd('state');
  assert.equal(await shell.executeJavaScript(`document.querySelector('#address').value`),'typed without a click');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGNQWJDynxLMMGrAqAGjBgwXAwAsmiMfC+hYhwAAAABJRU5ErkJggg==','base64');
  server=http.createServer((q,r)=>{if(q.url==='/icon.png'){r.writeHead(200,{'Content-Type':'image/png'});r.end(png);}else{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end('<title>Video title — full page details</title><link rel="icon" href="/icon.png"><h1>Fixture</h1>');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/video`;
  await cmd('navigate',url);await until(async()=>{s=await cmd('state');return s.tabs.find(t=>t.id===s.active)?.favicon;});
  const normalId=s.active;assert.equal(s.tabs.find(t=>t.id===normalId).title,'Video title — full page details');
  await until(()=>shell.executeJavaScript(`(()=>{const b=document.querySelector('.tab.active [role=tab]');window.tabNode=b;return b.title.includes(${JSON.stringify(url)})&&!!b.querySelector('img')})()`));
  await cmd('state');await sleep(150);assert.equal(await shell.executeJavaScript(`window.tabNode===document.querySelector('.tab.active [role=tab]')`),true);
  await cmd('muteTab',normalId);s=await cmd('state');assert(s.tabs.find(t=>t.id===normalId).muted);await cmd('muteTab',normalId);
  await cmd('cleanTest');await until(async()=>{s=await cmd('state');const tab=s.tabs.find(t=>t.id===s.active);return tab?.private&&tab.url===url&&tab.favicon;});
  const linkedPrivateId=s.active,linkedPage=webContents.getAllWebContents().find(w=>w.getURL()===url&&w.isFocused());assert(linkedPage);
  await until(()=>shell.executeJavaScript(`document.querySelector('#address').value===${JSON.stringify(url)}`));
  assert.equal(shell.isFocused(),false);await cmd('close',linkedPrivateId);
  await cmd('new');await until(()=>shell.executeJavaScript(`document.activeElement.id==='address'`));
  await shell.insertText('second tab typing');await sleep(250);assert.equal(await shell.executeJavaScript(`document.querySelector('#address').value`),'second tab typing');
  if(process.env.SUKOAA_TEST_SCREENSHOT) {const image=await win.capturePage();fs.writeFileSync(process.env.SUKOAA_TEST_SCREENSHOT,image.toPNG());}
  await cmd('new',true);s=await cmd('state');const privateId=s.active;
  await cmd('navigate',url);await until(async()=>{s=await cmd('state');return s.tabs.find(t=>t.id===privateId)?.favicon;});
  await cmd('close',privateId);s=await cmd('state');assert.equal(s.canReopen,false);
  await cmd('close',normalId);s=await cmd('state');assert.equal(s.canReopen,true);
  shell.sendInputEvent({type:'keyDown',keyCode:'T',modifiers:['control','shift']});shell.sendInputEvent({type:'keyUp',keyCode:'T',modifiers:['control','shift']});
  await until(async()=>{s=await cmd('state');return s.tabs.some(t=>t.url===url)});assert.equal(s.canReopen,false);assert(!s.tabs.some(t=>t.private));
  const before=s.active;shell.sendInputEvent({type:'keyDown',keyCode:'Tab',modifiers:['control']});shell.sendInputEvent({type:'keyUp',keyCode:'Tab',modifiers:['control']});
  await until(async()=>{s=await cmd('state');return s.active!==before});
  await cmd('close',s.tabs.find(t=>t.url===url).id);await cmd('clear',{history:true});s=await cmd('state');assert.equal(s.canReopen,false);
  console.log('PASS: immediate new-tab typing; real page title/favicon in normal and private tabs; full hover title/URL; stable tab DOM; mute toggle; Ctrl+Shift+T restores only regular tabs; Ctrl+Tab; clearing history clears recently closed tabs');
  server.close();clearTimeout(timeout);app.exit(0);
 }catch(e){console.error(e);server?.close();clearTimeout(timeout);app.exit(1);}
});
