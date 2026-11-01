// SPDX-License-Identifier: GPL-3.0-or-later
const {app,BrowserWindow,webContents,dialog}=require('electron');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
app.enableSandbox=()=>{}; // Container test only; production sandbox stays enabled.
const profile=fs.mkdtempSync('/tmp/sukoaa-repair-test-');app.setPath('userData',profile);
fs.writeFileSync(path.join(profile,'filters-v3.txt'),'/fixture-blocked.js$script\n');
dialog.showMessageBox=async()=>({response:0});
require('../desktop/main.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,label='condition')=>{for(let i=0;i<500;i++){if(await fn())return;await sleep(20);}throw Error('timeout: '+label);};
const timeout=setTimeout(()=>{console.error('Repair/Lab smoke timeout');app.exit(1)},70000);
app.whenReady().then(async()=>{
 let server;
 try {
  let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');await until(()=>!win.webContents.isLoading());
  const shell=win.webContents,cmd=(name,arg)=>shell.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  let s;await until(async()=>{s=await cmd('state');return s.tabs.length});
  server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':q.url==='/fixture-blocked.js'?'text/javascript':'text/html'});r.end(q.url==='/fixture-blocked.js'?'window.scriptLoaded=true;':'<meta name="viewport" content="width=device-width, initial-scale=1"><title>Repair fixture</title><script src="/fixture-blocked.js"></script><h1>Comparison fixture</h1>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
  await cmd('navigate',url);await until(async()=>{s=await cmd('state');return s.tabs[0].blocked>0&&!s.tabs[0].loading},'initial script blocking');
  const sourceId=s.active,source=webContents.getAllWebContents().find(w=>w.getURL()===url);
  assert.equal(s.repair.blocked.script,1);
  await shell.executeJavaScript(`document.querySelector('#menu').click();document.querySelector('[data-view=repair]').click()`);
  assert.equal(await shell.executeJavaScript(`document.querySelector('[data-page=repair]').hidden`),false);
  await cmd('repairPause');await until(()=>source.executeJavaScript('window.scriptLoaded===true'),'temporary bypass');
  s=await cmd('state');assert(s.repair.active);assert.deepEqual(s.settings.exceptions,[]);
  await cmd('new');await cmd('navigate',url);await until(async()=>{s=await cmd('state');return s.tabs.find(t=>t.id===s.active).blocked>0},'other tab still protected');
  await cmd('close',s.active);await cmd('select',sourceId);await cmd('repairUndo');
  await until(async()=>{s=await cmd('state');return !s.repair.active&&s.tabs.find(t=>t.id===sourceId).blocked>0&&!s.tabs.find(t=>t.id===sourceId).loading},'undo protection');
  assert.equal(await source.executeJavaScript('window.scriptLoaded===true'),false);
  await source.executeJavaScript(`localStorage.setItem('normal','kept');document.cookie='normal=1; path=/';`);
  await cmd('repairFocus');await source.executeJavaScript(`window.open(${JSON.stringify(url+'story')})`,true);
  await until(async()=>{s=await cmd('state');return !!s.repair.popupHost},'observed popup');
  await cmd('repairPopup');s=await cmd('state');assert.notEqual(s.active,sourceId);await cmd('close',s.active);await cmd('select',sourceId);
  await cmd('labStart');await until(async()=>{s=await cmd('state');return s.lab&&s.lab.ids.every(id=>!s.tabs.find(t=>t.id===id)?.loading)},'three pages loaded');
  await until(async()=>{s=await cmd('labMeasure');return s.lab.report.length===3&&s.lab.report.every(r=>!r.loading)},'comparison metrics');
  assert.equal(s.active,sourceId,'Background comparison loads must not steal focus');
  const report=s.lab.report;assert.equal(report[0].localKeys,1);assert.equal(report[1].localKeys,0);assert.equal(report[2].localKeys,0);
  assert.equal(report[0].width,1280);assert.equal(report[1].width,1280);assert.equal(report[2].width,390);
  assert(s.lab.ids.slice(1).every(id=>s.tabs.find(t=>t.id===id).private));
  const clean=webContents.getAllWebContents().find(w=>w.getURL()===url&&w!==source&&w.session!==source.session),cleanSession=clean.session;
  await clean.executeJavaScript(`document.cookie='clean=1; path=/';localStorage.setItem('clean','temporary')`);
  await shell.executeJavaScript(`document.querySelector('#labDetails').click()`);await until(()=>shell.executeJavaScript(`!document.querySelector('[data-page=lab]').hidden`));
  await until(()=>shell.executeJavaScript(`document.querySelectorAll('#labReport table tr').length>5`));
  if(process.env.SUKOAA_REPAIR_SCREENSHOT){const image=await win.capturePage();fs.writeFileSync(process.env.SUKOAA_REPAIR_SCREENSHOT,image.toPNG());}
  await cmd('labClose');s=await cmd('state');assert.equal(s.lab,null);assert.equal(s.active,sourceId);assert(!s.tabs.some(t=>t.private));
  assert.equal((await cleanSession.cookies.get({url})).length,0);assert.equal(await source.executeJavaScript(`localStorage.getItem('normal')`),'kept');
  assert.equal(await shell.executeJavaScript(`document.querySelector('#history').children.length`),0,'Hidden history never rendered');
  await shell.executeJavaScript(`document.querySelector('[data-view=library]').click()`);
  await until(()=>shell.executeJavaScript(`document.querySelector('#history').children.length>0`));
  console.log('PASS: observed blocking; tab-only temporary repair and Undo; popup retry; live 1280/1280/390 comparison; isolated storage; private cleanup; current-session preservation; on-demand history rendering');
  server.close();clearTimeout(timeout);app.exit(0);
 }catch(e){console.error(e);server?.close();clearTimeout(timeout);app.exit(1);}
});
