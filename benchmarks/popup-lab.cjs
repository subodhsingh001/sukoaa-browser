// Actual desktop WindowOpenHandler with deterministic native-dialog responses.
const {app,BrowserWindow,webContents,dialog}=require('electron');const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
app.enableSandbox=()=>{};app.setPath('userData',fs.mkdtempSync('/tmp/aegis-popup-lab-'));
let response=0,prompts=0;dialog.showMessageBox=async()=>{prompts++;return {response}};
require('../desktop/main.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));async function until(f,label){for(let i=0;i<200;i++){if(await f())return;await wait(10)}throw Error(label)}
const timer=setTimeout(()=>{console.error('popup lab timeout');app.exit(1)},20000);
app.whenReady().then(()=>{const win=BrowserWindow.getAllWindows()[0];win.webContents.once('did-finish-load',async()=>{let server;try{
 server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end('<title>Popup fixture</title><p>Readable article</p>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;const command=(name,arg)=>win.webContents.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
 await command('navigate',base+'/source');await until(()=>webContents.getAllWebContents().some(w=>w.getURL()===base+'/source'&&!w.isLoading()),'source loaded');
 const page=webContents.getAllWebContents().find(w=>w.getURL()===base+'/source');const before=(await command('state')).tabs.length;
 await page.executeJavaScript(`window.open(${JSON.stringify(base+'/blocked')},'_blank')`,false);await until(()=>prompts===1,'block prompt');await wait(80);assert.equal((await command('state')).tabs.length,before);
 response=1;await page.executeJavaScript(`window.open(${JSON.stringify(base+'/approved')},'_blank')`,true);await until(async()=>(await command('state')).tabs.length===before+1,'approved tab');await until(()=>webContents.getAllWebContents().some(w=>w.getURL()===base+'/approved'&&!w.isLoading()),'approved article');
 const result={date:new Date().toISOString(),engine:process.versions.electron,blockedRequest:{promptShown:true,newTabs:0},approvedRequest:{promptShown:true,newTabs:1,destinationLoaded:true},limits:'Desktop only. Dialog decisions are simulated at the native API boundary, not clicked on a physical desktop. Android transport/dialog behavior needs a phone/emulator.'};
 fs.writeFileSync(path.join(__dirname,'popup-lab-results.json'),JSON.stringify(result,null,2));console.log('PASS: blocked popup creates no tab; approved popup opens readable article in one tab');clearTimeout(timer);server.close();app.exit(0);
 }catch(e){console.error(e);clearTimeout(timer);server?.close();app.exit(1)}})});
