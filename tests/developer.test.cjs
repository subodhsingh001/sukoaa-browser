const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
// Exercise production event wiring against native API fakes; no remote pages run in Node.
test('fullscreen permission, native layout, element inspection, shortcuts and responsive tab lifecycle', async () => {
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aegis-events-'));
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
 for(let i=0;i<500&&!win;i++)await new Promise(r=>setTimeout(r,20));assert(win,'Browser initialized');win.webContents.emit('did-finish-load');await new Promise(r=>setImmediate(r));
 const command=(name,arg)=>handle({sender:win.webContents,senderFrame:win.webContents.mainFrame},name,arg);
 let state=await command('state');const id=state.active;const view=win.views[0];const page=view.webContents;
 await command('select',id); // Prime any first-use preference defaults.
 const originalWrite=fs.writeFileSync;let duplicateWrites=0;
 fs.writeFileSync=function(file,...args){if(String(file)===path.join(profile,'preferences.json.tmp'))duplicateWrites++;return originalWrite.call(this,file,...args);};
 try{await command('select',id);await command('select',id);}finally{fs.writeFileSync=originalWrite;}
 assert.equal(duplicateWrites,0,'Unchanged session preferences do not rewrite disk');
 // A newly selected tab has not navigated and must not touch emulation APIs.
 assert.equal(page.ready, false);
 await command('device','phone');
 assert.equal(page.emulation, undefined, 'Preview request waits for page readiness');
 page.ready = true;
 page.emit('dom-ready');
 assert.equal(page.emulation.viewSize.width, 390, 'Pending preview applies at DOM ready');
 await command('device','desktop');
 page.url='https://www.youtube.com/watch?v=fixture';
 page.mainFrame.url=page.url;
 const policy={sender:page,senderFrame:page.mainFrame};pageIPC.get('page-start-policy')(policy);
 assert.equal(policy.returnValue.youtube,true,'Recognized YouTube main frame receives only the local policy');
 const untrusted={sender:win.webContents,senderFrame:win.webContents.mainFrame};pageIPC.get('page-start-policy')(untrusted);assert.equal(untrusted.returnValue,null);
 const embedded={sender:page,senderFrame:{url:page.url}};pageIPC.get('page-start-policy')(embedded);assert.equal(embedded.returnValue,null,'Embedded frames cannot ask for main-frame policy');
 assert.equal(page.isAudioMuted(),true);
 pageIPC.get('page-media-activate')(embedded);assert.equal(page.isAudioMuted(),true,'Embedded IPC cannot activate host audio');
 pageIPC.get('page-media-activate')(policy);assert.equal(page.isAudioMuted(),false);
 await command('muteTab',id);assert.equal(page.isAudioMuted(),true);pageIPC.get('page-media-activate')(policy);assert.equal(page.isAudioMuted(),true,'A page gesture cannot override user mute');await command('muteTab',id);

 assert.equal(view.bounds.y,86);
 assert.equal(page.session.check(page,'fullscreen'),true);
 assert.equal(page.session.check(page,'automatic-fullscreen'),false);
 assert.equal(page.session.check(page,'media'),false);
 assert.equal(page.session.check(win.webContents,'fullscreen'),false);
 let grant;page.session.request(page,'fullscreen',value=>grant=value);assert.equal(grant,true);
 page.emit('enter-html-full-screen');assert.deepEqual(view.bounds,{x:0,y:0,width:1360,height:900});assert(win.full);
 page.emit('leave-html-full-screen');assert.equal(view.bounds.y,86);assert.equal(win.full,false);
 page.emit('context-menu',{}, {x:17,y:29,selectionText:'',linkURL:'',isEditable:false,editFlags:{}});
 menu.find(item=>item.label==='Inspect element').click();assert.deepEqual(page.inspected,{x:17,y:29});assert(page.open);assert.equal(page.mode,'right');
 let decision;
 page.session.beforeRequest({url:'devtools://devtools/bundled/devtools_app.html',webContentsId:page.devToolsWebContents.id},value=>decision=value);
 assert.deepEqual(decision,{},'Bundled DevTools frontend is permitted for its own contents');
 page.session.beforeRequest({url:'devtools://devtools/bundled/devtools_app.html',webContentsId:page.id},value=>decision=value);
 assert.equal(decision.cancel,true,'Ordinary web pages cannot request DevTools protocol resources');
 await command('devtools');assert.equal(page.open,false);
 app.emit('web-contents-created',{},page);
 let prevented=false;page.emit('before-input-event',{preventDefault(){prevented=true;}},{type:'keyDown',key:'F12'});assert(prevented);assert(page.open);
 for(const [device,width,height] of [['phone',390,844],['compact',360,800],['tablet',768,1024]]){
  await command('device',device);assert.deepEqual(page.emulation.viewSize,{width,height});assert.equal(view.bounds.y,130);assert(view.bounds.height<=770);assert.equal((await command('state')).tabs[0].device,device);
 }
 await command('new');assert.equal(page.session.check(page,'fullscreen'),false);
 await command('select',id);assert.equal(page.emulation.viewSize.width,768);
 await command('device','desktop');assert.equal(page.emulation,null);assert.equal(view.bounds.y,86);
 await command('panel',true);assert.equal(page.session.check(page,'fullscreen'),false);
 await command('panel',false);
 page.emit('enter-html-full-screen');await command('new');assert.equal(win.full,false);assert.equal(win.views[0].bounds.y,86);
 assert.equal(view.options.webPreferences.nodeIntegration,false);assert.equal(view.options.webPreferences.sandbox,true);assert.equal(view.options.webPreferences.contextIsolation,true);
 await assert.rejects(handle({sender:page,senderFrame:page.mainFrame},'devtools'),/Untrusted sender/);
 const beforeMove=await command('state'),moving=beforeMove.tabs[0].id;
 await command('moveTab',{id:moving,index:beforeMove.tabs.length-1});
 let moved=await command('state');assert.equal(moved.tabs.at(-1).id,moving);assert.equal(moved.active,beforeMove.active);
 for(const index of [-1,100,0.5,'1']){const order=moved.tabs.map(t=>t.id);await command('moveTab',{id:moving,index});assert.deepEqual((await command('state')).tabs.map(t=>t.id),order);}
 await command('tabMenu',moving);assert.equal(menu.find(item=>item.label==='Move tab right').enabled,false);
 for(const label of ['New tab','New private tab','Duplicate tab','Close tab','Minimize window','Maximize window'])assert(menu.some(item=>item.label===label),label);
 menu.find(item=>item.label==='Minimize window').click();assert(win.minimized);
 menu.find(item=>item.label==='Maximize window').click();assert(win.isMaximized());
 await command('tabMenu',moving);menu.find(item=>item.label==='Restore window').click();assert(!win.isMaximized());

 menu.find(item=>item.label==='Move tab left').click();moved=await command('state');assert.equal(moved.tabs.at(-2).id,moving);
 await assert.rejects(handle({sender:page,senderFrame:page.mainFrame},'moveTab',{id:moving,index:0}),/Untrusted sender/);
 fs.rmSync(profile,{recursive:true,force:true});
});
