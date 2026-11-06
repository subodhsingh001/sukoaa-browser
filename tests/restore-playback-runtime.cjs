// SPDX-License-Identifier: GPL-3.0-or-later
// Container-only child fixture: production keeps its OS sandbox and certificate validation.
const {app,BrowserWindow,webContents}=require('electron'),assert=require('node:assert/strict');
app.enableSandbox=()=>{};app.setPath('userData',process.env.SUKOAA_RESTORE_PROFILE);
app.commandLine.appendSwitch('no-proxy-server');app.commandLine.appendSwitch('host-resolver-rules','MAP www.youtube.com 127.0.0.1');
app.on('certificate-error',(event,_wc,url,_error,_cert,cb)=>{if(new URL(url).hostname==='www.youtube.com'){event.preventDefault();cb(true);}else cb(false);});
require('../desktop/main.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<500;i++){if(await fn())return;await wait(20);}if(label.includes('play')) {
 for(const page of webContents.getAllWebContents().filter(w=>w.getURL().startsWith(process.env.SUKOAA_RESTORE_ORIGIN)))console.error('Playback diagnostics',await page.executeJavaScript('JSON.stringify({url:location.href,hidden:document.hidden,focused:document.hasFocus(),started:window.started,playError:window.playError,paused:document.querySelector("audio")?.paused,ready:document.querySelector("audio")?.readyState,error:document.querySelector("audio")?.error?.message})').catch(String));
 }throw Error('Timeout '+label);}
const timeout=setTimeout(()=>app.exit(1),45000);
app.whenReady().then(async()=>{try{
 let win;await until(()=>{win=BrowserWindow.getAllWindows()[0];return win;},'window');const shell=win.webContents;await until(()=>!shell.isLoading(),'chrome');
 const cmd=(name,arg)=>shell.executeJavaScript(`window.aegis.command(${JSON.stringify(name)},${JSON.stringify(arg)})`);
 let state;await until(async()=>{state=await cmd('state');return state.tabs.length;},'tabs');win.show();win.focus();
 const origin=process.env.SUKOAA_RESTORE_ORIGIN;
 if(process.env.SUKOAA_RESTORE_PHASE==='save'){
  for(let i=0;i<3;i++){if(i)await cmd('new');await cmd('navigate',origin+'/'+i);}
  await until(async()=>{state=await cmd('state');return state.tabs.length===3&&state.tabs.every(t=>!t.loading&&t.url.startsWith(origin));},'three loaded tabs');
  await cmd('select',state.tabs[0].id);const page=webContents.getAllWebContents().find(w=>w.getURL()===origin+'/0');
  await until(()=>page.executeJavaScript('!document.hidden'),'foreground page visibility');page.focus();
  await until(async()=>win.isFocused()&&page.isFocused()&&await page.executeJavaScript('document.hasFocus()&&!document.hidden'),'manual-play focus');
  assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),true);
  page.sendInputEvent({type:'mouseDown',x:25,y:18,button:'left',clickCount:1});page.sendInputEvent({type:'mouseUp',x:25,y:18,button:'left',clickCount:1});await until(()=>page.executeJavaScript('window.started===true'),'manual play');
  await cmd('select',state.tabs[1].id);await wait(300);assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),false);assert.equal(page.isAudioMuted(),false);
  await cmd('select',state.tabs[0].id);console.log('PASS started video continues while another tab is selected; three URLs saved for real restart');
 }else{
  await until(async()=>{state=await cmd('state');return state.tabs.length===3&&state.tabs.every(t=>!t.loading&&t.url.startsWith(origin));},'restored pages');
  assert.deepEqual(state.tabs.map(t=>t.url),[0,1,2].map(i=>origin+'/'+i));
  for(const tab of state.tabs){const page=webContents.getAllWebContents().find(w=>w.getURL()===tab.url);assert(page);assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),true);assert.equal(page.isAudioMuted(),true);assert.equal(await page.executeJavaScript('document.querySelector("audio").play().then(()=>"played",e=>e.name)'),'NotAllowedError');}
  const first=state.tabs[0],page=webContents.getAllWebContents().find(w=>w.getURL()===first.url);await cmd('select',first.id);await until(()=>page.executeJavaScript('!document.hidden'),'restored page visibility');page.focus();
  await until(async()=>win.isFocused()&&page.isFocused()&&await page.executeJavaScript('document.hasFocus()&&!document.hidden'),'restored manual-play focus');
  page.sendInputEvent({type:'mouseDown',x:25,y:18,button:'left',clickCount:1});page.sendInputEvent({type:'mouseUp',x:25,y:18,button:'left',clickCount:1});await until(()=>page.executeJavaScript('window.started===true'),'restore manual play');
  await cmd('select',state.tabs[1].id);await wait(300);assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),false);
  await page.executeJavaScript('document.querySelector("audio").pause()');await cmd('select',first.id);await cmd('select',state.tabs[2].id);await wait(100);assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'),true);
  console.log('PASS real browser restart restores all three URLs silently; Play starts only the chosen page; tab switching continues playback; manual pause is retained');
 }
 clearTimeout(timeout);win.close();
}catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}});
