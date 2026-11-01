// Root/headless test harness only. Production keeps its sandbox enabled.
const {app,BrowserWindow}=require('electron');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.enableSandbox=()=>{};const profile=fs.mkdtempSync('/tmp/aegis-beta-legal-');app.setPath('userData',profile);
const original=global.fetch;let urls=[];
global.fetch=async url=>{urls.push(url);return {ok:true,text:async()=>url.endsWith('resources.json')?JSON.stringify({scriptlets:[],resources:[],padding:'x'.repeat(1500)}):'! mock harmless filter\n'.repeat(100)};};
require('../desktop/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));const timeout=setTimeout(()=>{console.error('Legal test timeout');app.exit(1)},30000);
app.whenReady().then(async()=>{let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');await new Promise(resolve=>{if(!win.webContents.isLoading())resolve();else win.webContents.once('did-finish-load',resolve);});await (async()=>{try{
 const js=c=>win.webContents.executeJavaScript(c);const cmd=(n,a)=>js(`window.aegis.command(${JSON.stringify(n)},${JSON.stringify(a)})`);
 for(let k=0;k<120;k++){if((await cmd('state')).tabs.length)break;await pause(40);}
 const privacy=await cmd('legal','privacy');assert(privacy.legal.includes('NO')&&privacy.legal.includes('PRIVATE BROWSING'));
 assert((await cmd('legal','../../LICENSE')).error.includes('Unknown legal'));
 await js(`document.getElementById('menu').click();document.querySelector('[data-view="legal"]').click();document.querySelector('[data-legal="privacy"]').click()`);await pause(150);
 assert(await js(`document.getElementById('legalText').textContent.includes('PRIVATE BROWSING')`));
 const result=await cmd('update');assert(result.error.includes('Unreviewed scriptlet update rejected'));
 assert(!fs.existsSync(path.join(profile,'filters-v3.txt')));assert(!fs.existsSync(path.join(profile,'resources-v3.json')));
 assert(urls.filter(u=>u.includes('ublock-origin')).every(u=>u.includes('7f5784d0a1dc177171ee3d6d39a7e4ac7a7eecec')));
 console.log('PASS: offline privacy UI, legal path allowlist, immutable scriptlet fetch and bad-hash update rejection without cache writes');clearTimeout(timeout);global.fetch=original;app.exit(0);
 }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}})();});
