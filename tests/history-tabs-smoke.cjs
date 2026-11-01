// Root/headless override is confined to this test; production sandbox stays enabled.
const {app,BrowserWindow,webContents}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
app.enableSandbox=()=>{};
const profile=fs.mkdtempSync('/tmp/aegis-history-tabs-');app.setPath('userData',profile);
fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({restoreSession:false,history:[
 {url:'https://example.com/duplicate',title:'Delete this visit',time:1},
 {url:'https://example.com/duplicate',title:'Keep duplicate visit',time:1}
]}));
require('../desktop/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){if(await fn())return;await pause(40);}throw Error('Timeout: '+label);}
const timer=setTimeout(()=>{console.error('History/tab test timeout');app.exit(1)},35000);
app.whenReady().then(async()=>{
 let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');
 await new Promise(resolve=>{if(!win.webContents.isLoading())resolve();else win.webContents.once('did-finish-load',resolve);});await (async()=>{
 let server;
 try{
  const js=code=>win.webContents.executeJavaScript(code);
  const command=(name,arg)=>js(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
  await until(async()=>(await command('state')).tabs.length===1,'startup');
  let state=await command('state');const normalId=state.active;
  const migrated=state.settings.history.map(x=>x.id);
  assert(migrated.every(Boolean));assert.notEqual(migrated[0],migrated[1]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'))).history.map(x=>x.id),migrated);
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');const send=()=>res.end(`<title>${req.url}</title><p>Fixture</p>`);if(req.url.startsWith('/slow'))setTimeout(send,350);else send();});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  await command('navigate',origin+'/normal');
  await until(async()=>(await command('state')).settings.history.some(x=>x.url===origin+'/normal'),'normal history');
  await js(`document.getElementById('menu').click();document.querySelector('[data-view="library"]').click()`);
  await until(()=>js(`document.querySelectorAll('#history .entry').length===3`),'history rows');
  await js(`Array.from(document.querySelectorAll('#history .entry')).find(row=>row.textContent.includes('Delete this visit')).lastElementChild.click()`);
  await until(async()=>!(await command('state')).settings.history.some(x=>x.id===migrated[0]),'delete visit');
  state=await command('state');assert(state.settings.history.some(x=>x.id===migrated[1]),'duplicate retained');
  const normalHistory=JSON.stringify(state.settings.history);
  await command('new',true);const privateId=(await command('state')).active;
  await command('navigate',origin+'/search?q=secret');
  await until(async()=>(await command('state')).tabs.some(x=>x.id===privateId&&!x.loading&&x.url.includes('secret')),'private search');
  const privatePage=webContents.getAllWebContents().find(w=>w.getURL().includes('q=secret'));
  await privatePage.executeJavaScript('document.cookie="secret=yes";localStorage.setItem("secret","yes")');
  const privateSession=privatePage.session;
  state=await command('state');assert.equal(JSON.stringify(state.settings.history),normalHistory);
  assert(!JSON.stringify(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json')))).includes('q=secret'),'private URL absent from disk');
  await command('select',normalId);await js(`document.getElementById('tabMenu').click()`);
  await until(()=>js(`document.querySelectorAll('#tabOverview .entry').length===2`),'tab list');
  assert.equal(await js(`document.querySelector('[data-page="tabs"]').hidden`),false);
  await js(`document.getElementById('tabSearch').value='private';document.getElementById('tabSearch').dispatchEvent(new Event('input'))`);
  assert.equal(await js(`document.querySelectorAll('#tabOverview .entry').length`),1);
  await js(`document.querySelector('#tabOverview .entry').lastElementChild.click()`);
  await until(async()=>(await command('state')).tabs.length===1,'background private close');
  state=await command('state');assert.equal(state.active,normalId);
  await until(async()=>(await privateSession.cookies.get({})).length===0,'private cookies cleared');
  assert.equal(JSON.stringify(state.settings.history),normalHistory);
  await command('cleanTest');await until(async()=>(await command('state')).tabs.some(x=>x.private&&!x.loading&&x.url===origin+'/normal'),'fresh private');
  const clean=webContents.getAllWebContents().find(w=>w.getURL()===origin+'/normal'&&!w.session.isPersistent());
  assert(clean);assert.equal(await clean.executeJavaScript('localStorage.getItem("secret")'),null);
  await command('close',(await command('state')).active);
  await command('new');const pendingId=(await command('state')).active;
  await command('navigate',origin+'/slow');await command('close',pendingId);await pause(500);
  assert(!(await command('state')).settings.history.some(x=>x.url===origin+'/slow'));
  await js(`document.getElementById('tabSearch').value='';document.getElementById('tabSearch').dispatchEvent(new Event('input'));document.getElementById('tabMenu').click()`);
  win.setContentSize(720,600);await pause(100);
  const geometry=await js(`({height:document.querySelector('header').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth,right:document.getElementById('tabMenu').getBoundingClientRect().right,width:innerWidth})`);
  assert.equal(geometry.height,86);assert.equal(geometry.overflow,false);assert(geometry.right<=geometry.width-146);
  console.log('PASS: persisted legacy IDs, exact duplicate visit deletion through UI, private search absent from disk history/session, filtered background tab close, cookie cleanup, fresh private storage, late callbacks, two-row minimum-width geometry');
  clearTimeout(timer);server.close();app.exit(0);
 }catch(error){console.error(error);try{console.log('DEBUG',await win.webContents.executeJavaScript(`({opened,view,rows:document.querySelectorAll('#history .entry').length,history:state?.settings.history.length,panel:document.getElementById('panel').hidden})`));}catch{}clearTimeout(timer);server?.close();app.exit(1);}
 })();
});
