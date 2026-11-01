// Local container harness only. Production keeps the OS sandbox enabled.
const {spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('../desktop/node_modules/playwright');
const binary=path.resolve(__dirname,'../desktop/node_modules/electron/dist/electron');
async function run(directory,expected){
 const child=spawn(binary,[path.join(__dirname,'packaged-runtime.cjs'),'--no-sandbox','--remote-debugging-port=0','--user-data-dir='+directory],{env:{...process.env,XDG_CONFIG_HOME:directory,SUKOAA_TEST_PROFILE:directory},stdio:['ignore','ignore','pipe']});
 let browser,logs='';const closed=new Promise(resolve=>child.once('exit',resolve));
 try{
  const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Packaged startup timed out: '+logs.slice(-1800))),20000);child.stderr.on('data',chunk=>{logs+=chunk;const match=logs.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('error',reject);});
  browser=await chromium.connectOverCDP(endpoint);const context=browser.contexts()[0];let shell;
  for(let i=0;i<500&&!shell;i++){shell=context.pages().find(p=>p.url().endsWith('/index.html'));if(!shell)await new Promise(r=>setTimeout(r,20));}
  assert(shell,'Packaged browser chrome loaded; targets='+context.pages().map(p=>p.url()).join(',')+'; '+logs.slice(-4500));await shell.waitForFunction(()=>!!window.aegis);
  const command=(name,arg)=>shell.evaluate(([n,a])=>window.aegis.command(n,a),[name,arg]);
  const state=await command('state');assert.equal(state.runtime.version,'0.9.0');assert.equal(state.runtime.electron,'45.2.1');assert.equal(state.runtime.filters.source,expected);assert.equal(state.updates.configured,false);
  assert(state.tabs.length);let home;for(let i=0;i<500&&!home;i++){home=context.pages().find(p=>p.url().endsWith('/home.html'));if(!home)await new Promise(r=>setTimeout(r,20));}assert(home,'Home view loaded');await home.waitForLoadState('domcontentloaded');assert.equal(await home.evaluate(()=>{localStorage.setItem('test','yes');const value=localStorage.getItem('test');localStorage.removeItem('test');return value;}),'yes');await shell.locator('#menu').click();await shell.locator('[data-view=updates]').click();await shell.waitForFunction(()=>document.querySelector('#updateStatus').textContent.includes('not configured'));assert(await shell.locator('#checkApplicationUpdate').isDisabled());
  console.log('PASS packaged ASAR in container harness: '+expected+' filter initialization, native shell/preload/home, settings and disabled verified-update UI; '+state.runtime.filters.elapsedMs+' ms');
  await command('windowClose').catch(error=>{if(!/closed|destroyed/i.test(error.message))throw error;});await closed;
 }finally{child.kill();await closed;await browser?.close().catch(()=>{});}
}
(async()=>{const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sukoaa-packaged-'));try{await run(directory,'bundled');await fs.writeFile(path.join(directory,'filters-v3.txt'),'||ads.example^\n');await run(directory,'worker');await run(directory,'profile');}finally{await fs.rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});}})().catch(error=>{console.error(error);process.exitCode=1;});
