// Root/headless override is test-only; production sandbox stays enabled.
const {app,BrowserWindow,webContents}=require('electron');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
app.enableSandbox=()=>{};app.setPath('userData',fs.mkdtempSync('/tmp/aegis-zoom-'));
require('../desktop/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){if(await fn())return;await pause(40);}throw Error('Timeout '+label);}
const timeout=setTimeout(()=>{console.error('zoom timeout');app.exit(1)},35000);
app.whenReady().then(async()=>{
 let win;for(let ready=0;ready<500&&!win;ready++){win=BrowserWindow.getAllWindows()[0];if(!win)await new Promise(r=>setTimeout(r,20));}if(!win)throw Error('Browser window did not initialize');
 await new Promise(resolve=>{if(!win.webContents.isLoading())resolve();else win.webContents.once('did-finish-load',resolve);});await (async()=>{
 let server;
 try{
  const js=c=>win.webContents.executeJavaScript(c);
  const command=(n,a)=>js(`window.aegis.command(${JSON.stringify(n)},${JSON.stringify(a)})`);
  await until(async()=>(await command('state')).tabs.length===1,'startup');
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Zoom fixture</title><meta name="viewport" content="width=device-width"><style>body{margin:0}#wide{width:1400px;height:1800px;background:#eee}</style><div id="wide">Wide page</div>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
  await command('navigate',url);
  await until(async()=>(await command('state')).tabs.some(t=>t.url===url&&!t.loading),'fixture');
  let state=await command('state');const normalId=state.active;
  const page=webContents.getAllWebContents().find(w=>w.getURL()===url);
  const key=async(target,keyCode,modifiers=['control'])=>{target.focus();target.sendInputEvent({type:'keyDown',keyCode,modifiers});target.sendInputEvent({type:'keyUp',keyCode,modifiers});await pause(100);};
  await key(page,'+',['control','shift']);await until(()=>page.getZoomFactor()>1,'page Ctrl+plus');
  assert.equal(Math.round(page.getZoomFactor()*100),110);
  await key(page,'-');await until(()=>Math.round(page.getZoomFactor()*100)===100,'page Ctrl-minus');
  await js(`document.getElementById('address').focus()`);await key(win.webContents,'=');
  await until(()=>Math.round(page.getZoomFactor()*100)===110,'address Ctrl-equals');
  assert.equal(win.webContents.getZoomFactor(),1,'shell chrome not scaled');
  await key(win.webContents,'0');await until(()=>Math.round(page.getZoomFactor()*100)===100,'Ctrl-zero');
  await command('new');await command('navigate',url);
  await until(async()=>(await command('state')).tabs.some(t=>t.id!==normalId&&!t.loading&&t.url===url),'same-origin tab');
  const otherId=(await command('state')).active;await command('zoom','in');
  assert.equal(Math.round(page.getZoomFactor()*100),100,'same-origin tab zoom isolated');
  await command('select',normalId);
  win.setContentSize(800,600);await pause(100);
  await command('zoom','fit');await pause(100);
  assert(page.getZoomFactor()<1,'fit shrinks wide page');
  let dimensions=await page.executeJavaScript('({width:innerWidth,content:document.documentElement.scrollWidth})');
  assert(dimensions.content<=dimensions.width+2,'wide content fits');
  const fit=page.getZoomFactor();await command('zoom','fit');assert.equal(page.getZoomFactor(),fit,'repeat fit is stable');
  await command('zoom','reset');assert.equal(page.getZoomFactor(),1);
  await js(`document.getElementById('menu').click()`);
  await js(`document.getElementById('zoomIn').click()`);await until(()=>page.getZoomFactor()>1,'menu zoom');
  await until(()=>js(`document.getElementById('zoomReset').textContent==='110%'`),'menu readout');
  await js(`document.getElementById('zoomReset').click()`);await until(()=>page.getZoomFactor()===1,'menu reset');
  await js(`document.getElementById('zoomFit').click()`);await until(()=>page.getZoomFactor()<1,'Fit button with page hidden behind menu');
  await js(`document.getElementById('zoomReset').click()`);await until(()=>page.getZoomFactor()===1,'reset after menu fit');
  const history=(await command('state')).settings.history.length;
  await command('new',true);await command('navigate',url+'?private');
  await until(async()=>(await command('state')).tabs.some(t=>t.private&&!t.loading&&t.url.includes('private')),'private');
  await command('zoom','out');state=await command('state');assert.equal(state.tabs.find(t=>t.id===state.active).zoom,90);assert.equal(state.settings.history.length,history);
  await command('close',state.active);await command('select',normalId);
  win.setContentSize(1600,900);await pause(100);assert.equal(page.getZoomFactor(),1,'resize preserves chosen scale');
  const bounds=win.contentView.children.find(v=>v.webContents===page).getBounds();assert.equal(bounds.width,1600);assert.equal(bounds.height,814);
  win.setContentSize(720,600);await pause(100);assert.equal(win.contentView.children.find(v=>v.webContents===page).getBounds().width,720);
  assert.equal(await js('document.documentElement.scrollWidth>innerWidth'),false);
  for(let i=0;i<25;i++)await command('zoom','out');assert.equal(Math.round(page.getZoomFactor()*100),25);
  for(let i=0;i<30;i++)await command('zoom','in');assert.equal(Math.round(page.getZoomFactor()*100),500);
  console.log('PASS: real page/address keyboard zoom/reset, isolated same-origin tabs, menu zoom/readout/reset, repeatable fit width, private zoom without history, large/small native viewport resize and 25–500% limits');
  clearTimeout(timeout);server.close();app.exit(0);
 }catch(e){console.error(e);clearTimeout(timeout);server?.close();app.exit(1);}
 })();
});
