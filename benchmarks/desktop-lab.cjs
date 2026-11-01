// Synthetic same-engine lab comparison. This is not a Chrome/Brave/Firefox ranking.
// Root/headless CI only: production keeps its OS sandbox.
const {app,BrowserWindow,webContents}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),os=require('node:os');
app.enableSandbox=()=>{};
app.commandLine.appendSwitch('host-resolver-rules','MAP pagead2.googlesyndication.com 127.0.0.1');
app.setPath('userData',fs.mkdtempSync('/tmp/aegis-lab-profile-'));
require('../desktop/main.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let n=0;n<300;n++){if(await fn())return;await sleep(10);}throw Error('timeout: '+label);}
const timeout=setTimeout(()=>{console.error('lab timed out');app.exit(1)},90000);
app.whenReady().then(()=>{
 const win=BrowserWindow.getAllWindows()[0];
 win.webContents.once('did-finish-load',async()=>{
  let server;
  try {
   const stats=new Map();let port;
   const png=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a4ZQAAAAASUVORK5CYII=','base64'),Buffer.alloc(32768)]);
   server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://fixture.test');const id=u.searchParams.get('run');
    if(!stats.has(id))stats.set(id,{adRequests:0,legitimateRequests:0,bytes:0});
    const s=stats.get(id);res.setHeader('Cache-Control','no-store');
    const send=(body,type,ad=false,delay=0)=>{
     const data=Buffer.isBuffer(body)?body:Buffer.from(body);s.bytes+=data.length;
     if(ad)s.adRequests++;else s.legitimateRequests++;
     setTimeout(()=>{res.setHeader('Content-Type',type);res.end(data);},delay);
    };
    if(u.pathname==='/story'){
     const ad=u.searchParams.get('scenario')==='ad-heavy';
     const images=Array.from({length:4},(_,i)=>`<img alt="content image" src="/image?run=${id}&i=${i}">`).join('');
     const advertising=ad?Array.from({length:12},(_,i)=>`<script async src="http://pagead2.googlesyndication.com:${port}/pagead/ads?run=${id}&slot=${i}"></script>`).join(''):'';
     send(`<title>Controlled article</title><article id="article"><h1>Legitimate article</h1>${'<p>Readable story content.</p>'.repeat(80)}${images}</article>${advertising}<script>fetch('/api?run=${id}').then(r=>r.json()).then(x=>{window.fixtureReady=x.ok})</script>`,'text/html');
    }else if(u.pathname==='/image')send(png,'image/png',false,15);
    else if(u.pathname==='/api')send('{"ok":true}','application/json',false,20);
    else if(u.pathname==='/pagead/ads')send(`(()=>{const end=performance.now()+6;while(performance.now()<end){}window.syntheticAds=(window.syntheticAds||0)+1})();/*${'a'.repeat(65536)}*/`,'application/javascript',true,80);
    else {res.writeHead(204);res.end();}
   });await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;
   const command=(name,arg)=>win.webContents.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
   await command('navigate',`http://127.0.0.1:${port}/story?scenario=clean&run=initial`);
   await until(()=>webContents.getAllWebContents().some(w=>w.getURL().includes('run=initial')&&!w.isLoading()),'startup fixture');
   const page=webContents.getAllWebContents().find(w=>w.getURL().includes('run=initial'));
   await page.session.setProxy({mode:'direct'});
   const raw=[];let isPaused=false;
   for(const scenario of ['clean','ad-heavy']){
    // One warm-up for renderer/JIT; every measured run still has an empty HTTP cache.
    for(let pair=-1;pair<7;pair++){
     const order=pair%2===0?[false,true]:[true,false];
     for(const paused of order){
      if(paused!==isPaused){await command('shield');isPaused=paused;await until(()=>!page.isLoading(),'shield reload');}
      await page.session.clearCache();
      const id=`${scenario}-${pair}-${paused?'paused':'on'}`;
      const url=`http://127.0.0.1:${port}/story?scenario=${scenario}&run=${id}`;
      const finished=new Promise((resolve,reject)=>{page.once('did-finish-load',resolve);});
      const start=process.hrtime.bigint();await command('navigate',url);await finished;
      await until(()=>page.executeJavaScript('window.fixtureReady===true'),'article API');
      const wallMs=Number(process.hrtime.bigint()-start)/1e6;
      const nav=await page.executeJavaScript(`({loadMs:performance.getEntriesByType('navigation')[0].loadEventEnd,article:!!document.querySelector('#article h1'),ads:window.syntheticAds||0})`);
      assert(nav.article,'legitimate article present');
      const state=await command('state'),tab=state.tabs.find(t=>t.id===state.active);
      if(pair>=0)raw.push({scenario,protection:paused?'paused':'on',pair,wallMs,loadEventMs:nav.loadMs,adScriptsExecuted:nav.ads,blocked:tab.blocked,...stats.get(id)});
     }
    }
   }
   const median=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]};
   const summary=[];
   for(const scenario of ['clean','ad-heavy'])for(const protection of ['on','paused']){
    const rows=raw.filter(x=>x.scenario===scenario&&x.protection===protection);
    summary.push({scenario,protection,runs:rows.length,medianWallMs:median(rows.map(x=>x.wallMs)),medianLoadEventMs:median(rows.map(x=>x.loadEventMs)),medianBytes:median(rows.map(x=>x.bytes)),medianAdRequests:median(rows.map(x=>x.adRequests)),medianAdScriptsExecuted:median(rows.map(x=>x.adScriptsExecuted)),medianBlocks:median(rows.map(x=>x.blocked))});
   }
   const result={date:new Date().toISOString(),environment:{platform:process.platform,architecture:process.arch,electron:process.versions.electron,chromium:process.versions.chrome,node:process.versions.node,cpu:os.cpus()[0]?.model},method:'Actual Aegis desktop shell; same Electron renderer, protection on vs site-paused; 7 alternating paired runs per scenario; renderer warm-up; empty HTTP cache and no-store resources; all origins mapped to loopback; synthetic ads each carry 64KiB, 80ms server delay and 6ms CPU work; no remote pages or comparator browsers. Root CI harness only disables sandbox.',summary,raw,limits:['Not an Android benchmark','Not a comparison against Chrome, Brave, Firefox or all browsers','Synthetic advertising delays/payloads; not representative of every website','No real-device battery, memory, startup, GPU/video or live YouTube tests']};
   fs.writeFileSync(path.join(__dirname,'desktop-lab-results.json'),JSON.stringify(result,null,2));
   console.log(JSON.stringify(summary,null,2));clearTimeout(timeout);server.close();app.exit(0);
  }catch(e){console.error(e);clearTimeout(timeout);server?.close();app.exit(1);}
 });
});
