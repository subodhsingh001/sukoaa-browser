// SPDX-License-Identifier: GPL-3.0-or-later
// Local container fixture; production always retains its OS sandbox.
const {app,BrowserWindow,webContents}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
app.enableSandbox=()=>{};
const profile=process.env.SUKOAA_REORDER_PROFILE || fs.mkdtempSync(path.join(os.tmpdir(),'sukoaa-reorder-'));
app.setPath('userData',profile);
require('../desktop/main.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<600;i++){if(await fn())return;await pause(20);}throw Error('Timeout: '+label);}
const timeout=setTimeout(()=>{console.error('Tab reorder smoke timeout');app.exit(1);},90000);
app.whenReady().then(async()=>{
 let server;
 try{
  let win;await until(()=>{win=BrowserWindow.getAllWindows()[0];return !!win;},'window');
  await until(()=>!win.webContents.isLoading(),'chrome loaded');const shell=win.webContents;
  const js=code=>shell.executeJavaScript(code),command=(name,arg)=>js(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  let state;await until(async()=>{state=await command('state');return state.tabs.length>0;},'tabs');
  if(process.env.SUKOAA_REORDER_RESTORE){
   const expected=JSON.parse(fs.readFileSync(path.join(profile,'reorder-expected.json'),'utf8'));
   await until(async()=>{state=await command('state');return state.tabs.length===expected.urls.length;},'restored count');
   assert.deepEqual(state.tabs.map(t=>t.url || null),expected.urls);assert(state.tabs.every(t=>!t.private));assert.equal(state.active,state.tabs[expected.activeIndex].id);
   console.log('PASS restart: reordered normal tabs and active index restored; private tabs excluded');
   clearTimeout(timeout);app.exit(0);return;
  }
  server=http.createServer((request,response)=>{response.setHeader('Content-Type','text/html');response.end(`<title>${request.url}</title><p>Local reorder fixture</p>`);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  await command('navigate',origin+'/a');await command('new');await command('navigate',origin+'/b');await command('new');await command('navigate',origin+'/c');
  await command('new',true);await command('navigate',origin+'/private-secret');
  await until(async()=>{state=await command('state');return state.tabs.length===4&&state.tabs.every(t=>!t.loading);},'fixtures');
  const [a,b,c,p]=state.tabs.map(t=>t.id);await command('select',b);win.show();win.focus();shell.focus();
  await until(()=>win.isFocused()&&shell.isFocused(),'focus');
  const originalPage=webContents.getAllWebContents().find(w=>w.getURL()===origin+'/b');
  await originalPage.executeJavaScript('window.reorderMarker=123;localStorage.setItem("reorder","preserved")');
  shell.debugger.attach('1.3');await shell.debugger.sendCommand('Input.setInterceptDrags',{enabled:true});
  let dragData;
  shell.debugger.on('message',(_e,method,params)=>{if(method==='Input.dragIntercepted')dragData=params.data;});
  async function beginDrag(id){
   dragData=null;
   const point=await js(`(()=>{const node=document.querySelector('[data-tab-id="${id}"]');node.scrollIntoView({inline:'nearest',block:'nearest'});const r=node.querySelector('[role=tab]').getBoundingClientRect();return {x:r.x+Math.min(35,r.width/2),y:r.y+r.height/2};})()`);
   await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
   await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
   for(const dx of [7,15,25])await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+dx,y:point.y,button:'left',buttons:1});
   await until(()=>!!dragData,'native drag start');
   assert.equal(await js('draggedTabId'),id);return point;
  }
  async function dragOver(x,y){for(const type of ['dragEnter','dragOver'])await shell.debugger.sendCommand('Input.dispatchDragEvent',{type,x,y,data:dragData});}
  async function drop(x,y){await shell.debugger.sendCommand('Input.dispatchDragEvent',{type:'dragOver',x,y,data:dragData});await shell.debugger.sendCommand('Input.dispatchDragEvent',{type:'drop',x,y,data:dragData});await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});}
  async function dragTo(id,target,after){
   await beginDrag(id);
   const point=await js(`(()=>{const r=document.querySelector('[data-tab-id="${target}"]').getBoundingClientRect();return {x:${after?'r.right-5':'r.left+5'},y:r.y+r.height/2};})()`);
   await dragOver(point.x,point.y);await drop(point.x,point.y);
  }
  await dragTo(a,c,true);await until(async()=>{state=await command('state');return state.tabs.map(t=>t.id).join()===`${b},${c},${a},${p}`;},'drag right');assert.equal(state.active,b);
  await dragTo(a,b,false);await until(async()=>{state=await command('state');return state.tabs.map(t=>t.id).join()===`${a},${b},${c},${p}`;},'drag left');assert.equal(state.active,b);
  assert.equal(await originalPage.executeJavaScript('window.reorderMarker'),123);assert.equal(await originalPage.executeJavaScript('localStorage.getItem("reorder")'),'preserved');
  await dragTo(p,a,false);await until(async()=>{state=await command('state');return state.tabs[0].id===p;},'private move');
  await until(()=>js('!document.querySelector(".tab-dragging,.drop-before,.drop-after")'),'drag cleanup');
  const cancelOrder=state.tabs.map(t=>t.id),cancelPoint=await beginDrag(c);
  await shell.debugger.sendCommand('Input.dispatchDragEvent',{type:'dragCancel',...cancelPoint,data:dragData});
  await shell.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...cancelPoint,button:'left',buttons:0,clickCount:1});
  await until(()=>js('draggedTabId===null&&!document.querySelector(".tab-dragging,.drop-before,.drop-after")'),'cancel cleanup');
  assert.deepEqual((await command('state')).tabs.map(t=>t.id),cancelOrder);
  const before=state.tabs.map(t=>t.id);
  await js(`(()=>{const dataTransfer=new DataTransfer();dataTransfer.setData('application/x-sukoaa-tab','${a}');document.querySelector('#tabs').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer,clientX:0}));})()`);
  assert.deepEqual((await command('state')).tabs.map(t=>t.id),before,'An unrelated external drop cannot reorder tabs');
  shell.sendInputEvent({type:'keyDown',keyCode:'PageUp',modifiers:['control','shift']});shell.sendInputEvent({type:'keyUp',keyCode:'PageUp',modifiers:['control','shift']});
  await until(async()=>{state=await command('state');return state.tabs[1].id===b;},'keyboard left');
  shell.sendInputEvent({type:'keyDown',keyCode:'PageDown',modifiers:['control','shift']});shell.sendInputEvent({type:'keyUp',keyCode:'PageDown',modifiers:['control','shift']});
  await until(async()=>{state=await command('state');return state.tabs[2].id===b;},'keyboard right');
  for(let i=0;i<14;i++)await command('new');await command('select',b);
  await beginDrag(p);const edge=await js(`(()=>{const r=document.querySelector('#tabs').getBoundingClientRect();return {left:r.left+2,right:r.right-2,y:r.y+r.height/2};})()`);
  await dragOver(edge.right,edge.y);await until(()=>js('document.querySelector("#tabs").scrollLeft>100'),'right auto-scroll');await drop(edge.right,edge.y);
  await until(async()=>{state=await command('state');return state.tabs.findIndex(t=>t.id===p)>1;},'overflow move right');
  await command('moveTab',{id:p,index:state.tabs.length-1});await until(()=>js(`document.querySelector('#tabs').lastElementChild.dataset.tabId==='${p}'`),'last tab render');
  await beginDrag(p);await dragOver(edge.left,edge.y);await until(()=>js('document.querySelector("#tabs").scrollLeft===0'),'left auto-scroll');await drop(edge.left,edge.y);
  await until(async()=>{state=await command('state');return state.tabs[0].id===p;},'overflow move left');assert.equal(state.active,b);
  const saved=JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).savedSession;
  assert.deepEqual(saved.urls,[origin+'/a',origin+'/b',origin+'/c',...Array(14).fill(null)]);assert.equal(saved.activeIndex,1);
  assert(!fs.readFileSync(path.join(profile,'preferences.json'),'utf8').includes('/private-secret'));
  fs.writeFileSync(path.join(profile,'reorder-expected.json'),JSON.stringify(saved));
  console.log('PASS native drag both directions; background selection preserved; live page/storage retained; private moves stay off disk; keyboard movement; cancel cleanup; unrelated drops rejected; overflow auto-scroll both directions');
  shell.debugger.detach();server.close();clearTimeout(timeout);app.exit(0);
 }catch(error){console.error(error);server?.close();clearTimeout(timeout);app.exit(1);}
});
