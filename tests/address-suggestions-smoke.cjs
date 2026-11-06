// SPDX-License-Identifier: GPL-3.0-or-later
// Native fixture only: production keeps the OS sandbox enabled.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
app.enableSandbox=()=>{};
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sukoaa-suggestions-'));app.setPath('userData',profile);
let requests=0;
const server=http.createServer((_req,res)=>{requests++;res.setHeader('Content-Type','text/html');res.end('<title>Local suggestion fixture</title>');});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<500;i++){if(await fn())return;await wait(20);}throw Error('Timeout: '+label);}
const timeout=setTimeout(()=>{console.error('Address suggestion smoke timeout');app.exit(1);},60000);
server.listen(0,'127.0.0.1',()=>{
 const origin=`http://127.0.0.1:${server.address().port}`;
 fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({restoreSession:false,bookmarks:[{url:origin+'/bookmarked',title:'Local bookmarked guide'}],history:[{id:'visited',url:origin+'/visited',title:'Local history guide',time:Date.now()},{id:'query',url:'https://www.google.com/search?q=learn+react',title:'Learn React - Search',time:Date.now()}]}));
 require('../desktop/main.cjs');
 app.whenReady().then(async()=>{try{
  let win;await until(()=>{win=BrowserWindow.getAllWindows()[0];return win;},'window');const shell=win.webContents;
  await until(()=>!shell.isLoading(),'chrome');
  const js=code=>shell.executeJavaScript(code),cmd=(name,arg)=>js(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  await until(async()=>!!(await cmd('state')).active,'initial tab');win.show();win.focus();
  async function type(text){await js("document.querySelector('#address').focus();document.querySelector('#address').select()");shell.focus();await shell.insertText(text);}
  const rows=()=>js("[...document.querySelector('#addressSuggestions').options].map(o=>({value:o.value,label:o.label}))");
  await type('local');await until(async()=>(await rows()).length===2,'history and bookmark matches');
  assert.equal(requests,0,'Typing local suggestions makes no network requests');
  assert.equal(await js("document.querySelector('#address').getAttribute('list')"),'addressSuggestions');
  shell.sendInputEvent({type:'keyDown',keyCode:'DOWN'});shell.sendInputEvent({type:'keyUp',keyCode:'DOWN'});
  shell.sendInputEvent({type:'keyDown',keyCode:'RETURN'});shell.sendInputEvent({type:'keyUp',keyCode:'RETURN'});
  await until(()=>js(`document.querySelector('#address').value===${JSON.stringify(origin+'/bookmarked')}`),'native keyboard selects suggestion');
  await cmd('new');await type('learn');await until(async()=>(await rows()).some(r=>r.value==='learn react'),'previous search query');
  await cmd('new',true);await type('learn');assert.deepEqual(await rows(),[],'Private address field excludes normal history');
  await type('local');assert.equal((await rows()).length,1,'Private field may suggest saved bookmarks');
  await cmd('navigate',origin+'/private-secret');await until(async()=>{const s=await cmd('state');return !s.tabs.find(t=>t.id===s.active).loading;},'private visit');
  await cmd('new');await type('private-secret');assert.deepEqual(await rows(),[],'Private visits never contribute normal suggestions');
  await cmd('clear',{history:true});await type('learn');await until(async()=>(await rows()).length===0,'cleared history removes previous search queries');
  await type('local');assert.equal((await rows()).length,1,'Clearing history keeps explicitly saved bookmarks');
  console.log('PASS native address suggestions: title/URL matches; keyboard selection; previous search terms; no network queries; private isolation; history clearing preserves bookmarks');
  server.close();clearTimeout(timeout);app.exit(0);
 }catch(error){console.error(error);const w=BrowserWindow.getAllWindows()[0];if(w)console.error(await w.webContents.executeJavaScript("JSON.stringify({value:document.querySelector('#address').value,rows:[...document.querySelector('#addressSuggestions').options].map(o=>o.value),active:state?.active,addressTabId,tabs:state?.tabs.map(t=>({id:t.id,private:t.private})),history:state?.settings.history})").catch(()=>''));server.close();clearTimeout(timeout);app.exit(1);}});
});
