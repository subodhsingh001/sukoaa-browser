const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
// Exercise production event wiring against native API fakes; no remote pages run in Node.
test('startup focus cannot overwrite saved tabs before restoration completes', async () => {
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aegis-events-'));
 const expected={urls:['https://example.com/a','https://example.org/b',...Array(14).fill(null)],activeIndex:1};
 fs.writeFileSync(path.join(profile,'preferences.json'),JSON.stringify({restoreSession:true,savedSession:expected}));
 const app=new EventEmitter();app.enableSandbox=()=>{};app.getPath=()=>profile;app.whenReady=()=>Promise.resolve();app.quit=()=>{};
 const all=[];let next=1, menu;
 class Contents extends EventEmitter {
  constructor(session){super();this.id=next++;this.session=session;this.mainFrame={framesInSubtree:[]};this.url='';this.navigationHistory={canGoBack:()=>false,canGoForward:()=>false};this.open=false;this.ready=false;all.push(this);}
  setZoomMode(mode){this.zoomMode=mode;} setZoomFactor(value){this.zoom=value;} getZoomFactor(){return this.zoom || 1;}
  isCurrentlyAudible(){return false;} isAudioMuted(){return !!this.muted;} setAudioMuted(value){this.muted=value;}
  getType(){return "window";} setWindowOpenHandler(){} getURL(){return this.url;} getTitle(){return "Fixture";} isDestroyed(){return false;} close(){this.closed=true;} focus(){} send(){}
  loadFile(file){this.url='file://'+file;return Promise.resolve();} loadURL(url){this.url=url;return Promise.resolve();}
  isDevToolsOpened(){return this.open;} openDevTools(options){this.open=true;this.devToolsWebContents={id:next++,getType:()=>"remote"};all.push(this.devToolsWebContents);this.mode=options.mode;this.emit('devtools-opened');}closeDevTools(){this.open=false;this.emit('devtools-closed');}
  inspectElement(x,y){this.inspected={x,y};} enableDeviceEmulation(options){assert(this.ready, "Never enable emulation before the native page is ready");this.emulation=options;}
  disableDeviceEmulation(){assert(this.ready, "Never reset emulation before the native page is ready");this.emulation=null;}
  executeJavaScript(code){this.lastScript=code;return Promise.resolve();}insertCSS(){return Promise.resolve();}reload(){}
 }
 class View {constructor(options){this.webContents=new Contents(options.webPreferences.session);this.options=options;}setBounds(b){this.bounds=b;}setVisible(v){this.visible=v;}}
 let win;
 class Window extends EventEmitter {
  constructor(){super();win=this;this.webContents=new Contents();this.views=[];this.contentView={addChildView:v=>this.views.push(v),removeChildView:v=>this.views=this.views.filter(x=>x!==v)};}
  isFocused(){return true;}loadFile(){return Promise.resolve();}getContentSize(){return [1360,900];}isDestroyed(){return false;}setMenu(){}isFullScreen(){return !!this.full;}
  isMaximized(){return !!this.max;}maximize(){this.max=true;}unmaximize(){this.max=false;}minimize(){this.minimized=true;}
  setFullScreen(value){if(this.full===value)return;this.full=value;this.emit(value?'enter-full-screen':'leave-full-screen');}
 }
 const sessions=new Map();const session={fromPartition(name){if(!sessions.has(name)){const s=new EventEmitter();Object.assign(s,{setPermissionRequestHandler:fn=>s.request=fn,setPermissionCheckHandler:fn=>s.check=fn,webRequest:{onHeadersReceived(){},onBeforeRequest(fn){s.beforeRequest=fn;}},clearCache:()=>Promise.resolve(),clearStorageData:()=>Promise.resolve()});sessions.set(name,s);}return sessions.get(name);}};
 let handle;const pageIPC=new Map();
 const electron={app,webContents:{fromId:id=>all.find(w=>w.id===id)},BrowserWindow:Window,WebContentsView:View,session,nativeTheme:{},dialog:{},clipboard:{},ipcMain:{on:(name,fn)=>pageIPC.set(name,fn),handle:(_name,fn)=>handle=fn},Menu:{buildFromTemplate(items){menu=items;return {popup(){}};}}};
 const filename=path.resolve(__dirname,'../desktop/main.cjs');
 const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));
 const original=loaded.require.bind(loaded);loaded.require=name=>name==='electron'?electron:original(name);
 loaded._compile(fs.readFileSync(filename,'utf8'),filename);
 for(let i=0;i<500&&!win;i++)await new Promise(r=>setTimeout(r,20));assert(win,'Browser initialized');
 try {
  // Force the event ordering that the CI display server exposes: window focus
  // arrives while the browser chrome has not finished and no tabs exist yet.
  win.emit('focus');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).savedSession,expected,'Early window focus must not erase saved tabs');
  win.webContents.emit('did-finish-load');
  await new Promise(r=>setImmediate(r));
  const command=(name,arg)=>handle({sender:win.webContents,senderFrame:win.webContents.mainFrame},name,arg);
  const state=await command('state');
  assert.deepEqual(state.tabs.map(t=>/^https?:/.test(t.url)?t.url:null),expected.urls);
  assert.equal(state.active,state.tabs[expected.activeIndex].id);
  assert(state.tabs.every(t=>!t.private));
  win.emit('focus');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).savedSession,expected,'Focus after restore persists the restored session');
  await command('new');
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).savedSession.urls.length,expected.urls.length+1,'Session saving resumes after startup');
  const beforeClose=JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).savedSession;
  win.emit('close');win.emit('closed');app.emit('before-quit');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'preferences.json'),'utf8')).savedSession,beforeClose,'Last-window shutdown retains the snapshot captured before its tabs were destroyed');
 } finally { fs.rmSync(profile,{recursive:true,force:true}); }
});
