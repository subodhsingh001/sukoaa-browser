// SPDX-License-Identifier: GPL-3.0-or-later
// Local fixtures only; root/container exception does not alter production sandboxing.
const {app,BrowserWindow,webContents,Menu,clipboard}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
app.enableSandbox=()=>{};const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sukoaa-windows-'));app.setPath('userData',profile);
let openedMenu;const original=Menu.buildFromTemplate;
Menu.buildFromTemplate=function(items){const menu=original.call(this,items),popup=menu.popup.bind(menu);menu.popup=function(...args){openedMenu={menu,items};return popup(...args);};return menu;};
require('../desktop/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<600;i++){if(await fn())return;await pause(20);}throw Error('Timeout: '+label);}
const timeout=setTimeout(()=>{console.error('Window/editing timeout');app.exit(1);},90000);
app.whenReady().then(async()=>{
 let server;
 try {
  let first;await until(()=>{first=BrowserWindow.getAllWindows()[0];return !!first;},'first window');await until(()=>!first.webContents.isLoading(),'chrome');
  const command=(win,name,arg)=>win.webContents.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  await until(async()=>!!(await command(first,'state')).active,'first tab');first.show();first.focus();
  async function context(wc,selector,action,select=true){
   wc.focus();await wc.executeJavaScript(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();${select?'e.select();':''}})()`);
   const point=await wc.executeJavaScript(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+Math.min(24,r.width/2)),y:Math.round(r.y+r.height/2)}})()`);
   openedMenu=null;wc.sendInputEvent({type:'mouseDown',...point,button:'right',clickCount:1});wc.sendInputEvent({type:'mouseUp',...point,button:'right',clickCount:1});
   await until(()=>!!openedMenu,'native context menu');const {menu,items}=openedMenu;assert(items.some(x=>x.label==='Copy'));const item=items.find(x=>x.label===action);assert(item && item.enabled!==false,action+' enabled');menu.closePopup();item.click();await pause(70);
  }
  const shell=first.webContents;await shell.executeJavaScript(`document.getElementById('address').value='clipboard address'`);
  await context(shell,'#address','Copy');assert.equal(await clipboard.readText(),'clipboard address');
  await clipboard.writeText('https://example.com/paste');await context(shell,'#address','Paste');assert.equal(await shell.executeJavaScript(`document.getElementById('address').value`),'https://example.com/paste');
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Live edit fixture</title><textarea id="edit">page selection</textarea><input id="field" value="input selection"><p id="text">selectable text</p><div style="height:2000px">scroll</div>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/live`;
  await clipboard.writeText(url);await context(shell,'#address','Paste and go');let page;await until(()=>{page=webContents.getAllWebContents().find(w=>w.getURL()===url);return page&&!page.isLoading();},'page fixture');
  await context(page,'#edit','Copy');assert.equal(await clipboard.readText(),'page selection');
  await clipboard.writeText('pasted page text');await context(page,'#field','Paste');assert.equal(await page.executeJavaScript('document.getElementById("field").value'),'pasted page text');
  await context(page,'#edit','Cut');assert.equal(await clipboard.readText(),'page selection');assert.equal(await page.executeJavaScript('document.getElementById("edit").value'),'');
  console.log('PASS native right-click menus: address Copy/Paste; page Copy/Paste/Cut; correct clipboard and target field');
  await page.executeJavaScript('window.liveMarker=123;document.getElementById("edit").value="unsaved draft";scrollTo(0,500)');
  const moving=(await command(first,'state')).active;await command(first,'new');
  await command(first,'detachTab',moving);let second;await until(()=>{second=BrowserWindow.getAllWindows().find(w=>w!==first);return !!second;},'second full browser window');
  let state=await command(second,'state');assert.equal(state.active,moving);assert.equal(state.tabs.length,1);assert.equal(page.id,webContents.getAllWebContents().find(w=>w.getURL()===url).id);
  assert.equal(await page.executeJavaScript('liveMarker'),123);assert.equal(await page.executeJavaScript('document.getElementById("edit").value'),'unsaved draft');assert.equal(await page.executeJavaScript('scrollY'),500);
  await page.executeJavaScript('document.title="Title after moving"');await until(async()=>(await command(second,'state')).tabs[0].title==='Title after moving','event owner reattached');assert(!(await command(first,'state')).tabs.some(t=>t.id===moving));
  page.focus();page.sendInputEvent({type:'keyDown',keyCode:'L',modifiers:['control']});page.sendInputEvent({type:'keyUp',keyCode:'L',modifiers:['control']});
  await until(()=>second.webContents.executeJavaScript("document.activeElement.id==='address'"),'moved tab Ctrl+L targets its new chrome');
  page.focus();page.sendInputEvent({type:'keyDown',keyCode:'T',modifiers:['control']});page.sendInputEvent({type:'keyUp',keyCode:'T',modifiers:['control']});
  await until(async()=>(await command(second,'state')).tabs.length===2,'moved page Ctrl+T');
  const shortcutTab=(await command(second,'state')).active;await command(second,'close',shortcutTab);
  assert.equal((await command(first,'state')).tabs.length,1);
  await clipboard.writeText('moved paste');await context(page,'#field','Paste');assert.equal(await page.executeJavaScript('document.getElementById("field").value'),'moved paste');
  const beforeBlocked=(await command(second,'state')).tabs[0].blocked;await page.executeJavaScript('fetch("https://doubleclick.net/ad.js").catch(()=>{})');await until(async()=>(await command(second,'state')).tabs[0].blocked>beforeBlocked,'filtering follows moved tab');
  await command(second,'new');assert.equal((await command(second,'state')).tabs.length,2);assert.equal((await command(first,'state')).tabs.length,1);
  await command(second,'select',moving);second.close();await until(()=>second.isDestroyed(),'independent close');assert.equal((await command(first,'state')).tabs.length,1);
  console.log('PASS moving live tab preserves WebContents, unsaved form, scroll, title events, context editing and filtering; new window owns independent tabs/close');
  await command(first,'new',true);const privateId=(await command(first,'state')).active;await command(first,'detachTab',privateId);let privateWindow;await until(()=>{privateWindow=BrowserWindow.getAllWindows().find(w=>w!==first);return !!privateWindow;},'private detached window');assert((await command(privateWindow,'state')).tabs[0].private);await command(privateWindow,'navigate',url+'/private-secret');await until(async()=>!(await command(privateWindow,'state')).tabs[0].loading,'private loaded');assert(!fs.readFileSync(path.join(profile,'preferences.json'),'utf8').includes('private-secret'));privateWindow.close();
  console.log('PASS private mode follows moved tab and remains absent from saved history/session');
  first.setBounds({x:20,y:20,width:900,height:700});first.show();first.focus();await command(first,'new');await pause(200);
  const dragId=(await command(first,'state')).tabs[0].id;
  const point=await shell.executeJavaScript(`(()=>{const r=document.querySelector('[data-tab-id="${dragId}"] [role=tab]').getBoundingClientRect();return {x:Math.round(r.x+25),y:Math.round(r.y+r.height/2)}})()`),bounds=first.getContentBounds();
  const drag=spawnSync('python3',[path.join(__dirname,'native-pointer.py'),String(bounds.x+point.x),String(bounds.y+point.y),'1480','750'],{encoding:'utf8'});assert.equal(drag.status,0,drag.stderr);
  await until(()=>BrowserWindow.getAllWindows().length===2,'native drag outside creates window');
  const detached=BrowserWindow.getAllWindows().find(w=>w!==first);assert.equal((await command(detached,'state')).tabs[0].id,dragId);
  console.log('PASS real OS pointer drag outside window tears off tab into another Sukoaa window');
  detached.hide();first.focus();await command(first,'new');await pause(150);
  const insideId=(await command(first,'state')).tabs[0].id;
  const insidePoint=await shell.executeJavaScript(`(()=>{const r=document.querySelector('[data-tab-id="${insideId}"] [role=tab]').getBoundingClientRect();return {x:Math.round(r.x+25),y:Math.round(r.y+r.height/2)}})()`);
  const insideDrag=spawnSync('python3',[path.join(__dirname,'native-pointer.py'),String(bounds.x+insidePoint.x),String(bounds.y+insidePoint.y),'850','650'],{encoding:'utf8'});assert.equal(insideDrag.status,0,insideDrag.stderr);
  await until(()=>BrowserWindow.getAllWindows().length===3,'drag down out of tab strip creates window');
  const insideWindow=BrowserWindow.getAllWindows().find(w=>w!==first && w!==detached);assert.equal((await command(insideWindow,'state')).tabs[0].id,insideId);
  console.log('PASS real OS drag down into the page tears off tab without needing to leave the browser bounds');
  const contrast=await shell.executeJavaScript(`(()=>{const t=document.querySelector('.tab.active');return {border:getComputedStyle(t).borderBottomColor,weight:getComputedStyle(t.querySelector('[role=tab]')).fontWeight,rail:getComputedStyle(t).boxShadow}})()`);assert(Number(contrast.weight)>=700);assert(contrast.rail.includes('inset'));
  console.log('PASS active tab uses bold text, accent border and inset rail');
  server.close();clearTimeout(timeout);app.exit(0);
 } catch(error){console.error(error);server?.close();clearTimeout(timeout);app.exit(1);}
});
