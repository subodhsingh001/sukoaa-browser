// SPDX-License-Identifier: GPL-3.0-or-later
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  dialog,
  nativeTheme,
  Menu,
  clipboard,
  webContents,
} = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { FiltersEngine } = require("@ghostery/adblocker");
const { Request } = require("@ghostery/adblocker");
const shared = app.isPackaged
  ? path.join(__dirname, "shared")
  : path.join(__dirname, "../shared");
const {
  navigate,
  host,
  cosmetic,
  distractions,
  isYouTube,
  safeSession,
  sessionFromTabs,
} = require(path.join(shared, "core.cjs"));
const { parse: parseDomain } = require("tldts");
app.enableSandbox();
let win,
  engine,
  active = null,
  tabs = [],
  configured = new Set(),
  total = 0,
  downloads = [],
  panelOpen = false,
  restoring = false,
  closing = false,
  htmlFullscreenTab = null,
  browserFullscreen = false;
let data = {
  bookmarks: [],
  history: [],
  exceptions: [],
  search: "google",
  focus: false,
  strict: false,
  theme: "dark",
  restoreSession: true,
  savedSession: { urls: [], activeIndex: 0 },
  youtubeProtection: true,
  extensionPaths: [],
};

const {SitePermissions} = require('./site-permissions.cjs');
const {canWriteClipboard} = require('./clipboard-permissions.cjs');
const {pageLabel,ClosedTabs,reorderTabs}=require('./tab-tools.cjs');
const {tabIcon}=require('./tab-icons.cjs');
const closedTabs=new ClosedTabs();
const {PageRepair}=require('./page-repair.cjs');
const repairs=new PageRepair();
let lab=null;
const sitePermissions = new SitePermissions({
  saved:()=>{if(!data.sitePermissions || typeof data.sitePermissions !== 'object' || Array.isArray(data.sitePermissions)) data.sitePermissions={}; return data.sitePermissions;},
  save, find:wc=>tabs.find(t=>t.view.webContents===wc), active:()=>current(),
  prompt:options=>dialog.showMessageBox(win,options), changed:()=>emit()
});
const extensionRecords = new Map();
function extensionSession() { return session.fromPartition("persist:aegis"); }
function readExtension(folder) {
  const resolved = fs.realpathSync(folder);
  const file = path.join(resolved, "manifest.json");
  if (fs.statSync(file).size > 1024 * 1024) throw Error("Extension manifest is too large");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (![2,3].includes(manifest.manifest_version) || typeof manifest.name !== "string")
    throw Error("Select an unpacked extension folder containing a valid manifest.json");
  return {resolved, manifest};
}
async function loadExtensionFolder(folder) {
  const {resolved} = readExtension(folder);
  const extension = await extensionSession().extensions.loadExtension(resolved, {allowFileAccess:false});
  const m = extension.manifest;
  const page = m.action?.default_popup || m.browser_action?.default_popup || m.options_ui?.page || m.options_page;
  extensionRecords.set(extension.id, {id:extension.id, name:extension.name, version:extension.version,
    path:resolved, page:typeof page === "string" ? page : null, error:""});
  return extension;
}
async function restoreExtensions() {
  const paths = Array.isArray(data.extensionPaths) ? data.extensionPaths.filter(p=>typeof p === "string").slice(0,30) : [];
  data.extensionPaths = paths;
  for (const folder of paths) {
    try { await loadExtensionFolder(folder); }
    catch (error) {
      const id = "unavailable-" + crypto.createHash("sha256").update(folder).digest("hex").slice(0,16);
      extensionRecords.set(id,{id,path:folder,name:path.basename(folder),version:"",error:error.message,page:null});
    }
  }
}
async function installExtension() {
  if (data.extensionPaths.length >= 30) throw Error("Remove an extension first (30 extension limit)");
  const selected = await dialog.showOpenDialog(win,{title:"Choose an unpacked extension folder",properties:["openDirectory"]});
  if (selected.canceled || !selected.filePaths[0]) return;
  const {resolved,manifest:m} = readExtension(selected.filePaths[0]);
  if (data.extensionPaths.includes(resolved)) throw Error("This extension is already added");
  const permissions = [...(Array.isArray(m.permissions)?m.permissions:[]),...(Array.isArray(m.host_permissions)?m.host_permissions:[])];
  const review = await dialog.showMessageBox(win,{type:"question",title:"Add extension?",
    message:String(m.name).slice(0,200),detail:"Requested access: " + (permissions.join(", ") || "See manifest content-script site matches") +
      "\n\nContent-script sites: " + (m.content_scripts || []).flatMap(x=>Array.isArray(x.matches)?x.matches:[]).join(", ") +
      "\n\nInstall only extensions you trust. Partial Chrome API support. Extensions are excluded from private tabs. Keep this folder in place.",
    buttons:["Cancel","Add extension"],defaultId:0,cancelId:0});
  if (review.response !== 1) return;
  await loadExtensionFolder(resolved);
  data.extensionPaths.push(resolved); save();
}
function openExtension(id) {
  const row = extensionRecords.get(String(id));
  if (!row?.page || row.error) throw Error("This extension has no supported popup/options page. Content scripts run on matching normal tabs.");
  const base = `chrome-extension://${row.id}/`;
  const url = new URL(row.page,base);
  if (url.origin !== new URL(base).origin || !url.href.startsWith(base)) throw Error("Invalid extension page");
  const popup = new BrowserWindow({parent:win,width:450,height:620,title:row.name,
    webPreferences:{session:extensionSession(),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  popup.setMenu(null);
  popup.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  popup.webContents.on("will-navigate",(e,target)=>{if(!target.startsWith(base))e.preventDefault();});
  popup.loadURL(url.href).catch(()=>{});
}
const configPath = () => path.join(app.getPath("userData"), "preferences.json");
let lastSavedPreferences;
function save() {
  const serialized=JSON.stringify(data);
  if(serialized===lastSavedPreferences)return;
  fs.mkdirSync(path.dirname(configPath()), {recursive:true, mode:0o700});
  fs.writeFileSync(configPath() + ".tmp", serialized, {
    mode: 0o600,
  });
  fs.renameSync(configPath() + ".tmp", configPath());
  lastSavedPreferences=serialized;
}
function rememberSession() {
  if (restoring || closing) return;
  data.savedSession = data.restoreSession
    ? sessionFromTabs(tabs, active)
    : { urls: [], activeIndex: 0 };
  save();
}
const supplementNames = [
  "ublock/filters.txt",
  "ublock/quick-fixes.txt",
  "ublock/unbreak.txt",
];
const {loadFilters}=require('./filter-cache.cjs');
const {VerifiedUpdates,compareVersion}=require('./verified-updates.cjs');
let applicationUpdates;
let filterPerformance={cacheHit:false,elapsedMs:0};
function snapshot() {
  return {
    tabs: tabs.map((t) => ({
      id: t.id,
      title: pageLabel(t.title,t.url,t.private),
      favicon: t.favicon || '',
      audible: t.view.webContents.isCurrentlyAudible(),
      muted: !!t.userMuted,
      url: /^https?:/.test(t.url) ? t.url : "",
      private: t.private,
      blocked: t.blocked,
      zoom: Math.round(t.view.webContents.getZoomFactor() * 100),
      device: t.device || "desktop",
      devtools: t.view.webContents.isDevToolsOpened(),
      loading: t.loading,
      lite: !!t.lite,
      liteBlocked: t.liteBlocked || 0,
      loadMs: t.loadMs || 0,
      error: t.error,
      back: t.view.webContents.navigationHistory.canGoBack(),
      forward: t.view.webContents.navigationHistory.canGoForward(),
    })),
    active,
    canReopen: closedTabs.items.length>0,
    updates:applicationUpdates?.state || {configured:false,status:'disabled'},
    runtime:{version:require('./package.json').version,electron:process.versions.electron || '',chromium:process.versions.chrome || '',filters:filterPerformance},
    repair: current()?{...repairs.describe(current()),savedPaused:data.exceptions.includes(host(current().url))}:null,
    lab: lab?{...lab,report:lab.report || []}:null,
    permissions: sitePermissions.rows(current()),
    total,
    settings: data,
    downloads,
    extensions: [...extensionRecords.values()].map(({path: _path, ...row}) => row),
  };
}
let emitTimer;
function emit() {
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    if (win && !win.isDestroyed()) win.webContents.send("state", snapshot());
  }, 100);
}
function current() {
  return tabs.find((t) => t.id === active);
}
function trusted(e) {
  if (
    e.sender !== win.webContents ||
    e.senderFrame !== win.webContents.mainFrame
  )
    throw Error("Untrusted sender");
}
const zoomSteps = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];
async function pageZoom(action) {
  const tab = current();
  if (!tab || tab.closed || tab.view.webContents.isDestroyed()) return;
  const wc = tab.view.webContents;
  const request = tab.zoomRequest = (tab.zoomRequest || 0) + 1;
  const percent = Math.round(wc.getZoomFactor() * 100);
  let next;
  if (action === "in") next = zoomSteps.find(value => value > percent) || 500;
  else if (action === "out") next = [...zoomSteps].reverse().find(value => value < percent) || 25;
  else if (action === "reset") next = 100;
  else if (action === "fit") {
    // Measure at 100% so repeated Fit actions cannot compound zoom changes.
    wc.setZoomFactor(1);
    const size = await wc.executeJavaScript(`({viewport:Math.min(innerWidth, document.documentElement.clientWidth || innerWidth), content:Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0)})`);
    if (tab.closed || !tabs.includes(tab) || wc.isDestroyed() || tab.zoomRequest !== request) return;
    next = Math.max(25, Math.min(100, Math.floor(100 * size.viewport / Math.max(1, size.content))));
  } else throw Error("Invalid zoom action");
  wc.setZoomFactor(next / 100);
  emit();
}
const devices = {
  phone: { width: 390, height: 844 },
  compact: { width: 360, height: 800 },
  tablet: { width: 768, height: 1024 },
};
function layout() {
  const t = current();
  if (!win || !t || t.view.webContents.isDestroyed()) return;
  const [w, h] = win.getContentSize();
  if(lab) {layoutLab(w,h);return;}
  const fullscreen = htmlFullscreenTab === t.id;
  const device = !fullscreen && devices[t.device];
  const top = fullscreen ? 0 : device ? 130 : 86;
  const height = Math.max(1, h - top);
  t.view.setVisible(!panelOpen || fullscreen);
  if (device) {
    const scale = Math.min(1, w / device.width, height / device.height);
    t.view.setBounds({x: Math.max(0, Math.floor((w - device.width * scale) / 2)),
      y: top, width: Math.max(1, Math.floor(device.width * scale)),
      height: Math.max(1, Math.floor(device.height * scale))});
    // Electron dereferences the native render-widget view internally. New tabs
    // have no render-widget view until DOM ready: never call either emulation
    // method from the initial layout/select path.
    if (t.pageReady) {
      const options = {screenPosition: "desktop", screenSize: device,
        viewSize: device, deviceScaleFactor: 1, scale};
      const key = JSON.stringify(options);
      if (t.emulationKey !== key) {
        t.view.webContents.enableDeviceEmulation(options);
        t.emulationApplied = true;
        t.emulationKey = key;
      }
    }
  } else {
    if (t.pageReady && t.emulationApplied) {
      t.view.webContents.disableDeviceEmulation();
      t.emulationApplied = false;
      t.emulationKey = null;
    }
    t.view.setBounds({x: 0, y: top, width: w, height});
  }
}
function leaveFullscreen(t = current()) {
  if (!t || htmlFullscreenTab !== t.id) return;
  htmlFullscreenTab = null;
  t.view.webContents.executeJavaScript(
    "if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})"
  ).catch(() => {});
  if (win && !win.isDestroyed()) {
    win.setFullScreen(browserFullscreen);
    layout();
  }
}
function tools(t = current(), toggle = true) {
  if (!t) return;
  const wc = t.view.webContents;
  if (toggle && wc.isDevToolsOpened()) wc.closeDevTools();
  else wc.openDevTools({mode: t.device ? "detach" : "right"});
}
function setDevice(value) {
  const t = current();
  if (!t || htmlFullscreenTab) return;
  t.device = Object.hasOwn(devices, value) ? value : null;
  // Keep the requested viewport intact when developer tools are open.
  if (t.device && t.view.webContents.isDevToolsOpened()) {
    t.view.webContents.closeDevTools();
    tools(t, false);
  }
  layout();
  emit();
}
function pageMenu(t, params) {
  const wc = t.view.webContents;
  const items = [];
  if (/^https?:\/\//i.test(params.linkURL || "")) items.push(
    {label: "Open link in new tab", click: () => create(params.linkURL, t.private)},
    {label: "Copy link address", click: () => clipboard.writeText(params.linkURL)},
    {type: "separator"});
  if (params.isEditable) items.push(
    {label: "Undo", enabled: params.editFlags.canUndo, click: () => wc.undo()},
    {label: "Cut", enabled: params.editFlags.canCut, click: () => wc.cut()},
    {label: "Copy", enabled: params.editFlags.canCopy, click: () => wc.copy()},
    {label: "Paste", enabled: params.editFlags.canPaste, click: () => wc.paste()},
    {label: "Select all", click: () => wc.selectAll()}, {type: "separator"});
  else if (params.selectionText) items.push(
    {label: "Copy", click: () => wc.copy()}, {type: "separator"});
  items.push(
    {label: "Back", enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack()},
    {label: "Reload", click: () => wc.reload()},
    {label: "Reload without cached files", click: () => wc.reloadIgnoringCache()},
    {label: "Clean test in a new private tab", click: () => create(t.url, true)},
    {type: "separator"},
    {label: "Inspect element", click: () => { tools(t, false); wc.inspectElement(params.x, params.y); }},
    {label: "Developer tools", click: () => tools(t)},
    {label: "Device preview", submenu: [
      {label: "Desktop", type: "radio", checked: !t.device, click: () => setDevice("desktop")},
      ...Object.entries(devices).map(([key, d]) => ({label: `${key} — ${d.width} × ${d.height}`,
        type: "radio", checked: t.device === key, click: () => setDevice(key)})),
    ]});
  return Menu.buildFromTemplate(items);
}
function focusAddress(preserve = false) {
  const t=current();if(!t)return;
  win.webContents.focus();
  win.webContents.send('focus-address',{id:t.id,value:/^https?:/.test(t.url)?t.url:'',preserve});
}
// The host mute remains effective for WebAudio and cross-origin frames.
function mediaState(t, enabled, forcePause = false) {
  if (!t || t.closed || t.view.webContents.isDestroyed()) return;
  t.mediaActivated = enabled;
  t.view.webContents.setAudioMuted(!t.mediaActivated || !!t.userMuted);
  if (!enabled && forcePause) {
    const script="document.dispatchEvent(new Event('sukoaa-pause-media'));document.querySelectorAll('video,audio').forEach(m=>m.pause())";
    for (const frame of t.view.webContents.mainFrame.framesInSubtree) frame.executeJavaScript(script).catch(()=>{});
  }
}
ipcMain.on('page-start-policy', event => {
  const t=tabs.find(tab=>tab.view.webContents===event.sender);
  const frame=event.senderFrame;
  if (!t || frame!==event.sender.mainFrame) {event.returnValue=null;return;}
  const url=frame.url || t.url;
  event.returnValue={youtube:!!data.youtubeProtection && isYouTube(url) && !data.exceptions.includes(host(url)) && !repairs.active(t)};
});
ipcMain.on('page-media-activate', event => {
  const t=current();
  if(t && !panelOpen && event.sender===t.view.webContents && event.senderFrame===event.sender.mainFrame){t.addressPending=false;mediaState(t,true);}
});
function select(id) {
  if(lab&&!lab.ids.includes(id)){stopLab(id);return;}
  const old = current();
  if (old) { leaveFullscreen(old); win.contentView.removeChildView(old.view); }
  active = id;
  const t = current();
  if (t) {
    win.contentView.addChildView(t.view);
    layout();
    if(!t.url || t.url.startsWith('file:'))focusAddress();else t.view.webContents.focus();
  }
  rememberSession();
  emit();
}
function reopenTab() {
  if(tabs.length>=40)return;
  const saved=closedTabs.take();if(!saved)return;
  const t=create(saved.url);tabs.splice(tabs.indexOf(t),1);
  tabs.splice(Math.min(saved.index,tabs.length),0,t);rememberSession();emit();
}
function moveTab(id,index) {
  if(!reorderTabs(tabs,id,index))return;
  rememberSession();
  emit();
}
function tabMenu(id) {
  const t=tabs.find(tab=>tab.id===id);if(!t)return;
  const index=tabs.indexOf(t);
  return Menu.buildFromTemplate([
    {label:'New tab',accelerator:'CmdOrCtrl+T',enabled:tabs.length<40,click:()=>create(null,false)},
    {label:'New private tab',accelerator:'CmdOrCtrl+Shift+N',enabled:tabs.length<40,click:()=>create(null,true)},
    {type:'separator'},
    {label:'Duplicate tab',enabled:tabs.length<40,click:()=>create(/^https?:/.test(t.url)?t.url:null,t.private)},
    {label:t.userMuted?'Unmute tab':'Mute tab',click:()=>{t.userMuted=!t.userMuted;mediaState(t,t.mediaActivated);emit();}},
    {label:'Move tab left',enabled:index>0,click:()=>moveTab(id,tabs.indexOf(t)-1)},
    {label:'Move tab right',enabled:index<tabs.length-1,click:()=>moveTab(id,tabs.indexOf(t)+1)},
    {type:'separator'},
    {label:'Reopen closed tab',accelerator:'CmdOrCtrl+Shift+T',enabled:closedTabs.items.length>0,click:reopenTab},
    {label:'Close tab',click:()=>close(id)},
    {type:'separator'},
    {label:'Minimize window',click:()=>win.minimize()},
    {label:win.isMaximized()?'Restore window':'Maximize window',click:()=>{if(win.isMaximized())win.unmaximize();else win.maximize();}}
  ]);
}
function layoutLab(w,h) {
  const top=134, column=Math.max(1,Math.floor(w/3));
  lab.ids.forEach((id,index)=>{
    const tab=tabs.find(t=>t.id===id);if(!tab || tab.closed)return;
    const width=index===2?w-column*2:column;
    if(!win.contentView.children.includes(tab.view))win.contentView.addChildView(tab.view);
    tab.view.setVisible(!panelOpen);
    tab.view.setBounds({x:index*column,y:top,width:Math.max(1,width),height:Math.max(1,h-top)});
    if(tab.pageReady) {
      const size={width:index===2?390:1280,height:900};
      const options={screenPosition:'desktop',screenSize:size,viewSize:size,deviceScaleFactor:1,scale:Math.min(1,width/size.width,(h-top)/900)};
      const key=JSON.stringify(options);
      if(tab.emulationKey!==key){tab.view.webContents.enableDeviceEmulation(options);tab.emulationApplied=true;tab.emulationKey=key;}
    }
  });
}
function startLab() {
  if(lab){panelOpen=false;win.webContents.send('close-panel');layout();return;}
  const source=current();if(!/^https?:/.test(source?.url || ''))throw Error('Open a website before starting a comparison.');
  if(tabs.length>38)throw Error('Close two tabs to make room for the comparison.');
  const url=navigate(source.url,data.search);leaveFullscreen(source);
  const clean=create(url,true),mobile=create(url,true);
  lab={sourceId:source.id,ids:[source.id,clean.id,mobile.id],report:[]};
  panelOpen=false;win.webContents.send('close-panel');select(source.id);emit();
}
function stopLab(target) {
  if(!lab)return Promise.resolve();
  const previous=lab;lab=null;
  for(const id of previous.ids){const tab=tabs.find(t=>t.id===id);if(tab)win.contentView.removeChildView(tab.view);}
  active=tabs.some(t=>t.id===target)?target:previous.sourceId;
  const jobs=previous.ids.slice(1).map(id=>close(id));
  if(current())select(active);emit();return Promise.all(jobs);
}
async function measureLab() {
  if(!lab)throw Error('Start a comparison first.');const comparison=lab;
  const probe=`(()=>{const count=fn=>{try{return fn()}catch{return null}};const n=performance.getEntriesByType('navigation')[0];return {origin:location.origin,width:innerWidth,localKeys:count(()=>localStorage.length),sessionKeys:count(()=>sessionStorage.length),visibleCookies:count(()=>document.cookie?document.cookie.split(';').length:0),resources:performance.getEntriesByType('resource').length,loadMs:n&&n.loadEventEnd?Math.round(n.loadEventEnd-n.startTime):null}})()`;
  const report=await Promise.all(comparison.ids.map(async(id,index)=>{
    const tab=tabs.find(t=>t.id===id);if(!tab || tab.loading || !tab.pageReady)return {label:['Current','Clean','Mobile width'][index],loading:true};
    try {
      const data=await tab.view.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:probe}]);
      const permissions=sitePermissions.rows(tab).sites.find(row=>row.origin===data.origin);
      return {label:['Current','Clean','Mobile width'][index],...data,blocked:tab.blocked,
        permissions:['camera','microphone','location'].map(kind=>kind+': '+(permissions?.[kind] || 'ask')).join(' · ')};
    }catch{return {label:['Current','Clean','Mobile width'][index],loading:true};}
  }));
  if(lab===comparison){lab.report=report;emit();}
}
function allowed(t) {
  return !data.exceptions.includes(host(t.url)) && !repairs.active(t);
}
async function cosmetics(t) {
  if (!allowed(t) || t.view.webContents.isDestroyed()) return;
  try {
    const pageURL = t.url;
    const youtube = isYouTube(pageURL) && data.youtubeProtection;
    const filters = engine.getCosmeticsFilters({
      url: t.url,
      hostname: host(t.url),
      domain: parseDomain(t.url).domain,
      getBaseRules: true,
      getInjectionRules: youtube,
      getExtendedRules: false,
    });
    const wc = t.view.webContents;
    if (!t.stylesApplied) {
      t.stylesApplied = true;
      await wc.insertCSS(
        (filters.styles || "") + cosmetic + (data.focus ? distractions : ""),
      );
    }
    const scripts = youtube
      ? [
          ...(filters.scripts || []),
          fs.readFileSync(path.join(__dirname, "youtube-helper.js"), "utf8"),
        ]
      : [];
    if (
      wc.isDestroyed() ||
      t.url !== pageURL ||
      !allowed(t) ||
      !data.youtubeProtection
    )
      return;
    for (const script of scripts) {
      const key = crypto.createHash("sha256").update(script).digest("hex");
      if (t.injectedScripts.has(key)) continue;
      t.injectedScripts.add(key);
      const scoped =
        '(()=>{if(location.hostname!=="youtube.com"&&!location.hostname.endsWith(".youtube.com"))return;\n' +
        script +
        "\n})();";
      wc.executeJavaScript(scoped).catch(() => t.injectedScripts.delete(key));
    }
  } catch {}
}

function configure(s, priv = false) {
  if (configured.has(s)) return;
  configured.add(s);
  if (priv) s.webRequest.onHeadersReceived((details,callback)=>{
    if (!/^https?:/.test(details.url)) {callback({});return;}
    const headers = Object.fromEntries(Object.entries(details.responseHeaders || {}).filter(([key])=>!/^(cache-control|pragma|expires)$/i.test(key)));
    headers["Cache-Control"] = ["no-store"]; headers.Pragma = ["no-cache"];
    callback({responseHeaders:headers});
  });
  // Normal Fullscreen API keeps Chromium's user-gesture requirement.
  // Automatic fullscreen and unrelated permissions remain denied; supported site access asks first.
  const permits = (wc, permission) => permission === "fullscreen" &&
    !!wc && current()?.view.webContents === wc && !panelOpen && !lab &&
    /^https?:\/\//i.test(wc.getURL());
  s.setPermissionRequestHandler((wc, permission, callback, details) => {
    if(permission==='fullscreen') callback(permits(wc,permission));
    else if(permission==='clipboard-sanitized-write') {
      const allow=canWriteClipboard(wc,details?.requestingUrl,details,!!win?.isFocused() && !panelOpen && current()?.view.webContents===wc);
      if(!allow)repairs.note(tabs.find(t=>t.view.webContents===wc),'clipboard','Copy was denied: focus the website and click Copy again.');callback(allow);
    }
    else sitePermissions.request(wc,permission,allow=>{
      const tab=tabs.find(t=>t.view.webContents===wc);
      repairs.note(tab,'permission',permission+': '+(allow?'allowed':'denied'));callback(allow);emit();
    },details);
  });
  s.setPermissionCheckHandler((wc,permission,url,details)=> {
    if(permission==='fullscreen') return permits(wc,permission);
    if(permission==='clipboard-sanitized-write') return canWriteClipboard(wc,url,details,
      !!win?.isFocused() && !panelOpen && current()?.view.webContents===wc);
    return sitePermissions.check(wc,permission,url,details);
  });
  s.on("will-download", async (event, item, wc) => {
    const tab = tabs.find((t) => t.view.webContents === wc);
    if (!tab) {
      event.preventDefault();
      return;
    }
    const result = await dialog.showSaveDialog(win, {
      title: "Save download — open only files you trust",
      defaultPath: path.basename(item.getFilename()),
    });
    if (result.canceled || !result.filePath) {
      item.cancel();
      return;
    }
    item.setSavePath(result.filePath);
    const row = {
      name: path.basename(result.filePath),
      received: 0,
      total: item.getTotalBytes(),
      status: "Downloading",
    };
    downloads.unshift(row);
    downloads = downloads.slice(0, 50);
    item.on("updated", () => {
      row.received = item.getReceivedBytes();
      emit();
    });
    item.on("done", (_e, status) => {
      row.status = status;
      emit();
    });
    emit();
  });
  s.webRequest.onBeforeRequest((details, callback) => {
    // Electron creates the native DevTools frontend before exposing it via
    // the page's devToolsWebContents property. Only native "remote" contents
    // may load this internal protocol; regular website contents remain blocked.
    const isOwnDevTools = details.url.startsWith("devtools://devtools/") &&
      webContents.fromId(details.webContentsId)?.getType() === "remote";
    if (isOwnDevTools) { callback({}); return; }
    if (details.url.startsWith("chrome-extension://")) {
      let id; try { id = new URL(details.url).hostname; } catch {}
      callback({cancel: !(id && s.extensions?.getExtension(id))}); return;
    }
    if (!/^https?:/.test(details.url)) {
      callback({
        cancel:
          details.url !==
            require("node:url").pathToFileURL(path.join(__dirname, "home.html"))
              .href &&
          !["about:", "data:", "blob:"].some((p) => details.url.startsWith(p)),
      });
      return;
    }
    const t =
      tabs.find((t) => t.view.webContents.id === details.webContentsId) ||
      tabs.find(
        (t) =>
          t.view.webContents.session === s &&
          host(t.url) &&
          host(t.url) === host(details.referrer || ""),
      );
    if (t?.lite && !repairs.active(t) && ["image","media"].includes(details.resourceType)) {
      repairs.block(t,details.resourceType);
      t.liteBlocked = (t.liteBlocked || 0) + 1; emit(); callback({cancel:true}); return;
    }
    if (!t || details.resourceType === "mainFrame" || !allowed(t)) {
      callback({});
      return;
    }
    let cancel = false,
      redirectURL;
    try {
      const result = engine.match(
        Request.fromRawDetails({
          url: details.url,
          sourceUrl: t.url,
          type:
            {
              mainFrame: "main_frame",
              subFrame: "sub_frame",
              xhr: "xmlhttprequest",
              cspReport: "csp_report",
            }[details.resourceType] || details.resourceType,
        }),
      );
      cancel = result.match;
      if (result.redirect?.dataUrl?.startsWith("data:"))
        redirectURL = result.redirect.dataUrl;
      if (data.strict && details.resourceType === "ping") cancel = true;
    } catch {}
    if (cancel) {
      repairs.block(t,details.resourceType);
      t.blocked++;
      total++;
      emit();
    }
    callback(redirectURL ? { redirectURL } : { cancel });
  });
}
function create(url, priv = false) {
  if (tabs.length >= 40) throw Error("Close a tab before opening more");
  const partition = priv ? "private-" + crypto.randomUUID() : "persist:aegis";
  const s = session.fromPartition(partition, priv ? {cache:false} : {});
  configure(s, priv);
  const view = new WebContentsView({
    webPreferences: {
      session: s,
      preload: path.join(__dirname, "page-preload.cjs"),
      autoplayPolicy: "document-user-activation-required",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
  });
  const t = {
    id: crypto.randomUUID(),
    view,
    private: priv,
    addressPending: !url,
    mediaActivated: false,
    userMuted: false,
    title: priv ? "Private tab" : "New tab",
    url: url || "",
    blocked: 0,
    loading: false,
    lite: false,
    liteBlocked: 0,
    loadMs: 0,
    error: "",
    injectedScripts: new Set(),
    stylesApplied: false,
    suppressHistory: false,
    pageReady: false,
    navigationRevision:0,committedRevision:-1,historyRevision:-1,
    emulationApplied: false,
    emulationKey: null,
  };
  tabs.push(t);
  const wc = view.webContents;
  wc.setAudioMuted(true);
  wc.setZoomMode("isolated");
  wc.on("zoom-changed", (_event, direction) => {
    if (current() === t) pageZoom(direction === "in" ? "in" : "out").catch(() => {});
  });
  wc.on("context-menu", (_event, params) => pageMenu(t, params).popup({window: win}));
  wc.on("devtools-opened", emit);
  wc.on("devtools-closed", emit);
  wc.on("enter-html-full-screen", () => {
    if (active !== t.id) { wc.executeJavaScript("document.exitFullscreen().catch(()=>{})").catch(()=>{}); return; }
    htmlFullscreenTab = t.id;
    panelOpen = false;
    win.setFullScreen(true);
    layout();
  });
  wc.on("leave-html-full-screen", () => leaveFullscreen(t));
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      dialog
        .showMessageBox(win, {
          type: "question",
          title: "Open a new tab?",
          message: "This website wants to open another page.",
          detail: host(url),
          buttons: ["Block", "Open"],
          defaultId: 0,
          cancelId: 0,
        })
        .then((r) => {
          if(!t.closed&&r.response!==1){repairs.popup(t,url);emit();}
          if (r.response === 1 && win && !win.isDestroyed())
            try {
              create(url, t.private);
            } catch {}
        });
    }
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    t.suppressHistory = false;
    if (!/^https?:\/\//i.test(url)) e.preventDefault();
  });
  wc.on("will-redirect", (e, url) => {
    if (!/^https?:\/\//i.test(url)) e.preventDefault();
  });
  wc.on("page-title-updated", (_e, title) => {
    t.title = title.slice(0, 180);
    emit();
  });
  wc.on('page-favicon-updated',(_e,urls)=>tabIcon(t,urls,emit));
  wc.on('audio-state-changed',emit);
  wc.on('media-started-playing',()=>{if(!t.mediaActivated)mediaState(t,false,true);});
  wc.on('before-mouse-event',(_event,mouse)=>{if(mouse.type==='mouseDown'){t.addressPending=false;if(current()===t)mediaState(t,true);}if(mouse.type==='mouseDown'&&lab?.ids.includes(t.id)){active=t.id;emit();}});
  wc.on('focus',()=>{if(t.addressPending && current()===t && !panelOpen)setImmediate(()=>{if(t.addressPending && current()===t && !panelOpen)focusAddress(true);});if(lab?.ids.includes(t.id)&&active!==t.id&&!panelOpen)setImmediate(()=>{if(lab&&active!==t.id&&!panelOpen&&!win.webContents.isFocused())current()?.view.webContents.focus();});});
  wc.on("did-start-loading", () => {
    t.loadStarted = Date.now();
    t.loading = true;
    emit();
  });
  wc.on("did-stop-loading", () => {
    t.loading = false;
    t.loadMs = t.loadStarted ? Math.max(0,Date.now() - t.loadStarted) : 0;
    emit();
  });
  wc.on("dom-ready", () => {
    t.pageReady = true;
    t.emulationKey = null;
    if (active === t.id || lab?.ids.includes(t.id)) layout();
    cosmetics(t);
    if(t.addressPending && current()===t)focusAddress(true);
  });
  wc.on("did-start-navigation", (_e, url, _inPlace, main) => {
    if (main) {
      t.blocked = 0;
      t.liteBlocked = 0;
      t.error = "";
      t.url = url;
      if (!_inPlace) {
        t.navigationRevision++;
        if(/^https?:/.test(url))t.addressPending=false;
        mediaState(t,false);
        repairs.navigated(t,url);
        if(!repairs.active(t))clearTimeout(t.repairTimer);
        t.favicon='';t.iconRevision=(t.iconRevision || 0)+1;
        t.title=/^https?:/.test(url)?host(url):(t.private?'Private tab':'New tab');
        t.pageReady = false;
        t.emulationKey = null;
        leaveFullscreen(t);
        t.injectedScripts.clear();
        t.stylesApplied = false;
      }
      emit();
    }
  });
  const changed = (_e, url, isMainFrame) => {
    if (isMainFrame === false) return;
    t.url = url;
    rememberSession();
    emit();
  };
  wc.on("did-navigate",()=>{t.committedRevision=t.navigationRevision;});
  wc.on("did-navigate-in-page", changed);
  wc.on("did-finish-load", () => {
    if (closing || t.closed || !tabs.includes(t)) return;
    t.url = wc.getURL();
    t.title=(wc.getTitle() || host(t.url) || t.title).slice(0,180);
    cosmetics(t);
    if (!closing && !t.closed && tabs.includes(t) && !t.private && !t.suppressHistory && t.committedRevision===t.navigationRevision && t.historyRevision!==t.navigationRevision && /^https?:/.test(t.url)) {
      t.historyRevision=t.navigationRevision;
      data.history.unshift({ id: crypto.randomUUID(), url: t.url, title: t.title, time: Date.now() });
      data.history = data.history.slice(0, 500);
      save();
    }
    rememberSession();
    emit();
    if(t.addressPending && current()===t)focusAddress(true);
  });
  wc.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main && !inPlace)t.permissionRevision=(t.permissionRevision || 0)+1;});
  wc.on("did-fail-load", (_e, code, description, _url, main) => {
    if (main && code !== -3) {
      t.error = description;
      rememberSession();
      emit();
    }
  });
  wc.on("render-process-gone", () => {
    t.pageReady = false;
    t.emulationKey = null;
    t.error = "Page stopped. Reload to recover.";
    emit();
  });
  panelOpen=false;
  win.webContents.send('close-panel');
  select(t.id);
  if (url) wc.loadURL(url).catch(() => {});
  else wc.loadFile(path.join(__dirname, "home.html")).catch(() => {});
  return t;
}
async function close(id) {
  if(lab?.ids.includes(id)){const source=lab.sourceId;await stopLab();if(id!==source)return;}
  const t = tabs.find((t) => t.id === id);
  if (!t) return;
  closedTabs.remember(t,tabs.indexOf(t));
  clearTimeout(t.repairTimer);repairs.forget(t);
  t.closed = true;
  if (active === id) { leaveFullscreen(t); win.contentView.removeChildView(t.view); }
  tabs = tabs.filter((x) => x !== t);
  const tabSession = t.view.webContents.session;
  t.view.webContents.close();
  if (t.private) {
    await tabSession.clearStorageData().catch(() => {});
    await tabSession.clearCache().catch(() => {});
    configured.delete(tabSession);
  }
  if (active === id) {
    active = null;
    if (tabs.length) select(tabs[tabs.length - 1].id);
    else create();
  }
  rememberSession();
  emit();
}
app.whenReady().then(async () => {
  try {
    data = { ...data, ...JSON.parse(fs.readFileSync(configPath(), "utf8")) };
  } catch {}
  // Assign persistent IDs once so duplicate URLs and same-millisecond visits
  // can be removed independently, even after a restart.
  data.history = (Array.isArray(data.history) ? data.history : [])
    .filter(entry => entry && typeof entry.url === "string")
    .map(entry => ({...entry, id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID()}));
  save();
  let minimumVersion=require('./package.json').version;
  try {if(compareVersion(data.highestVerifiedVersion,minimumVersion)>0)minimumVersion=data.highestVerifiedVersion;}catch{}
  applicationUpdates=new VerifiedUpdates(JSON.parse(fs.readFileSync(path.join(shared,'release-channel.json'),'utf8')),{currentVersion:require('./package.json').version,minimumVersion,platform:process.platform,arch:process.arch,onSeenVersion:version=>{data.highestVerifiedVersion=version;save();}});
  nativeTheme.themeSource = ["dark", "light", "system"].includes(data.theme)
    ? data.theme
    : "dark";
  const filterFile = path.join(app.getPath("userData"), "filters-v3.txt");
  const bundled = ["easylist.txt", "easyprivacy.txt", "starter.txt"]
    .map((p) => {
      try {
        return fs.readFileSync(path.join(shared, p), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  const supplement = supplementNames
    .map((name) => fs.readFileSync(path.join(shared, name), "utf8"))
    .join("\n");
  const resourcesFile = path.join(app.getPath("userData"), "resources-v3.json");
  const bundledResources = fs.readFileSync(path.join(shared, "ublock/resources.json"), "utf8");
  const cachedResources = fs.existsSync(resourcesFile) ? fs.readFileSync(resourcesFile, "utf8") : bundledResources;
  const expectedResourceHash = JSON.parse(fs.readFileSync(path.join(shared, "filter-provenance.json"), "utf8")).files["resources.json"].sha256;
  const resources = crypto.createHash("sha256").update(cachedResources).digest("hex") === expectedResourceHash
    ? cachedResources : bundledResources;
  try {
    const result=await loadFilters({filters:fs.existsSync(filterFile)?fs.readFileSync(filterFile,'utf8'):bundled+'\n'+supplement,resources,directory:app.getPath('userData'),bundledDirectory:path.join(shared,'compiled')});
    engine=result.engine;filterPerformance={cacheHit:result.cacheHit,source:result.source,elapsedMs:Math.round(result.elapsedMs)};
  } catch {
    const result=await loadFilters({filters:bundled+'\n'+supplement,resources:bundledResources,directory:app.getPath('userData'),bundledDirectory:path.join(shared,'compiled')});
    engine=result.engine;filterPerformance={cacheHit:result.cacheHit,source:result.source,elapsedMs:Math.round(result.elapsedMs)};
  }
  if(applicationUpdates.config.enabled&&applicationUpdates.config.automaticChecks) {
    const timer=setTimeout(()=>applicationUpdates.check().catch(()=>{}).finally(emit),30000);timer.unref?.();
  }
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 720,
    minHeight: 500,
    title: "Sukoaa Browser",
    ...(process.platform === "darwin" ? { titleBarStyle: "hidden" } : { frame: false }),
    icon: path.join(__dirname, "assets/aegis.png"),
    backgroundColor: "#0c111b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, "index.html"));
  win.setMenu(null);
  win.on("resize", layout);
  win.on("enter-full-screen", layout);
  win.on("leave-full-screen", () => { browserFullscreen = false; if (htmlFullscreenTab) leaveFullscreen(); layout(); });
  win.on("close", () => {
    rememberSession();
    closing = true;
  });
  win.on("closed", () => {
    for (const t of tabs)
      if (!t.view.webContents.isDestroyed()) t.view.webContents.close();
    tabs = [];
    win = null;
  });
  ipcMain.handle("command", async (e, name, arg) => {
    trusted(e);
    try {
      const t = current();
      if (name === "state") return snapshot();
      if(name==='applicationUpdateCheck') {
        const operation=applicationUpdates.check();emit();try{await operation;}finally{emit();}return snapshot();
      }
      if(name==='applicationUpdateDownload') {
        if(!applicationUpdates.candidate?.available)throw Error('Check for a verified update first');
        const version=applicationUpdates.candidate.version;
        const choice=await dialog.showSaveDialog(win,{title:'Save verified Sukoaa update',defaultPath:path.join(app.getPath('downloads'),`SukoaaBrowser-${version}-${process.platform}-${process.arch}${process.platform==='win32'?'-Setup.exe':'.zip'}`)});
        if(!choice.canceled&&choice.filePath){try{await applicationUpdates.download(choice.filePath,emit);}finally{emit();}}
        return snapshot();
      }
      if(name==='repairPause') {
        repairs.start(t);clearTimeout(t.repairTimer);
        t.repairTimer=setTimeout(()=>{if(!t.closed){repairs.stop(t);t.view.webContents.reload();emit();}},300000);
        t.view.webContents.reload();emit();return snapshot();
      }
      if(name==='repairUndo') {clearTimeout(t.repairTimer);repairs.stop(t);t.view.webContents.reload();emit();return snapshot();}
      if(name==='repairFocus') {panelOpen=false;win.webContents.send('close-panel');layout();t.view.webContents.focus();return snapshot();}
      if(name==='repairPopup') {const url=repairs.popupURL(t);if(!url)throw Error('No recent blocked link for this page.');create(url,t.private);return snapshot();}
      if(name==='labStart'){startLab();return snapshot();}
      if(name==='labClose'){await stopLab();return snapshot();}
      if(name==='labMeasure'){await measureLab();return snapshot();}
      if (name === "permissionSet" || name === "permissionReset") {
        if(name==='permissionReset') sitePermissions.reset(t);
        else sitePermissions.set(t,arg?.origin,arg?.kind,arg?.value);
        // Reload affected views to stop capture/watchers after changing access.
        for(const tab of tabs) if(tab.private===t.private && (!t.private || tab===t)) tab.view.webContents.reload();
        emit();return snapshot();
      }
      if (name === "legal") {
        const files = {privacy:"privacy.txt", notices:"notices.txt", license:"gpl.txt", sources:"sources.txt"};
        if (!Object.hasOwn(files, arg)) throw Error("Unknown legal document");
        return {legal:fs.readFileSync(path.join(shared, "legal", files[arg]), "utf8")};
      }
      if (name === "windowClose") { win.close(); return; }
      if (name === "windowMinimize") win.minimize();
      else if (name === "windowMaximize") { if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
      else if (name === "devtools") tools();
      else if (name === "device") setDevice(String(arg));
      else if (name === "fullscreen") { browserFullscreen = !win.isFullScreen(); win.setFullScreen(browserFullscreen); }
      else if (name === "new") create(null, arg === true);
      else if (name === 'reopen') reopenTab();
      else if (name === 'tabMenu') tabMenu(String(arg))?.popup({window:win});
      else if (name === 'moveTab') moveTab(arg?.id,arg?.index);
      else if (name === 'muteTab') {
        const tab=tabs.find(tab=>tab.id===String(arg));
        if(tab){tab.userMuted=!tab.userMuted;mediaState(tab,tab.mediaActivated);}
      }
      else if (name === "cleanTest") create(/^https?:/.test(t.url) ? t.url : null, true);
      else if (name === "zoom") await pageZoom(arg);
      else if (name === "hardReload") { t.suppressHistory = true; t.view.webContents.reloadIgnoringCache(); }
      else if (name === "lite") { t.lite = !t.lite; t.view.webContents.reload(); }
      else if (name === "extensionInstall") await installExtension();
      else if (name === "extensionOpen") openExtension(arg);
      else if (name === "extensionRemove") {
        const row = extensionRecords.get(String(arg));
        if (row) {
          if (!row.error) extensionSession().extensions.removeExtension(row.id);
          extensionRecords.delete(row.id);
          data.extensionPaths = data.extensionPaths.filter(p=>p !== row.path); save();
        }
      }
      else if (name === "select") {
        if (tabs.some((x) => x.id === String(arg))) select(String(arg));
      } else if (name === "close") await close(String(arg));
      else if (name === "navigate") {
        const url = navigate(arg, data.search);
        if (url) {
          t.suppressHistory = false;
          t.addressPending=false;
          t.view.webContents.loadURL(url).catch(() => {});
          t.view.webContents.focus();
        }
      } else if (
        name === "back" &&
        t.view.webContents.navigationHistory.canGoBack()
      ) {
        t.suppressHistory = false;
        t.view.webContents.navigationHistory.goBack();
      } else if (
        name === "forward" &&
        t.view.webContents.navigationHistory.canGoForward()
      ) {
        t.suppressHistory = false;
        t.view.webContents.navigationHistory.goForward();
      } else if (name === "reload") {
        t.suppressHistory = false;
        t.view.webContents.reload();
      } else if (name === "home") {
        t.url = "";
        t.addressPending=true;
        t.view.webContents.loadFile(path.join(__dirname, "home.html"));
        focusAddress();
      } else if (name === "bookmark" && /^https?:/.test(t.url)) {
        if (!data.bookmarks.some((b) => b.url === t.url))
          data.bookmarks.push({ url: t.url, title: t.title });
        save();
      } else if (name === "removeHistory") {
        if (typeof arg !== "string") throw Error("Invalid history entry");
        data.history = data.history.filter(entry => entry.id !== arg);
        save();
      } else if (name === "removeBookmark") {
        data.bookmarks = data.bookmarks.filter((b) => b.url !== arg);
        save();
      } else if (name === "panel") {
        panelOpen = arg === true;
        t.view.setVisible(!panelOpen);
        layout();
        if(!panelOpen && (!t.url || t.url.startsWith("file:")))focusAddress(true);
      } else if (name === "shield") {
        const h = host(t.url);
        if (h) {
          data.exceptions = data.exceptions.includes(h)
            ? data.exceptions.filter((x) => x !== h)
            : [...data.exceptions, h];
          save();
          t.view.webContents.reload();
        }
      } else if (name === "settings") {
        const reloadNeeded = ["focus", "strict", "youtubeProtection"].some(
          (key) => typeof arg?.[key] === "boolean",
        );
        if (typeof arg?.restoreSession === "boolean") {
          data.restoreSession = arg.restoreSession;
          data.savedSession = data.restoreSession
            ? sessionFromTabs(tabs, active)
            : { urls: [], activeIndex: 0 };
        }
        if (typeof arg?.youtubeProtection === "boolean")
          data.youtubeProtection = arg.youtubeProtection;
        if (["dark", "light", "system"].includes(arg?.theme)) {
          data.theme = arg.theme;
          let minimumVersion=require('./package.json').version;
  try {if(compareVersion(data.highestVerifiedVersion,minimumVersion)>0)minimumVersion=data.highestVerifiedVersion;}catch{}
  applicationUpdates=new VerifiedUpdates(JSON.parse(fs.readFileSync(path.join(shared,'release-channel.json'),'utf8')),{currentVersion:require('./package.json').version,minimumVersion,platform:process.platform,arch:process.arch,onSeenVersion:version=>{data.highestVerifiedVersion=version;save();}});
  nativeTheme.themeSource = arg.theme;
        }
        if (["google", "duckduckgo", "bing"].includes(arg?.search))
          data.search = arg.search;
        if (typeof arg?.focus === "boolean") data.focus = arg.focus;
        if (typeof arg?.strict === "boolean") data.strict = arg.strict;
        save();
        if (reloadNeeded) for (const tab of tabs) tab.view.webContents.reload();
      } else if (name === "clear") {
        const choices =
          arg && typeof arg === "object"
            ? arg
            : { history: true, cache: true, cookies: true, session: true };
        if (
          !["history", "cache", "cookies", "session"].some(
            (key) => choices[key] === true,
          )
        )
          throw Error("Choose at least one type of browsing data.");
        if (choices.history === true || choices.cookies === true)
          for (const tab of tabs) tab.suppressHistory = true;
        for (const s of configured) {
          if (choices.cache === true) await s.clearCache();
          if (choices.cookies === true) await s.clearStorageData();
        }
        if (choices.history === true) data.history = [];
        if (choices.history === true || choices.session === true) closedTabs.clear();
        if (choices.session === true) {
          data.restoreSession = false;
          data.savedSession = { urls: [], activeIndex: 0 };
        }
        save();
        if (choices.cookies === true)
          for (const tab of tabs) {
            tab.suppressHistory = true;
            tab.view.webContents.reload();
          }
      } else if (name === "update") {
        const urls = [
          "https://easylist.to/easylist/easylist.txt",
          "https://easylist.to/easylist/easyprivacy.txt",
          ...["filters.txt", "quick-fixes.txt", "unbreak.txt"].map(
            (name) =>
              "https://raw.githubusercontent.com/ghostery/adblocker/7f5784d0a1dc177171ee3d6d39a7e4ac7a7eecec/packages/adblocker/assets/ublock-origin/" +
              name,
          ),
        ];
        const fetchText = require('./filter-download.cjs').fetchFilterText;
        const [parts, resourceData] = await Promise.all([
          Promise.all(urls.map(fetchText)),
          fetchText(
            "https://raw.githubusercontent.com/ghostery/adblocker/7f5784d0a1dc177171ee3d6d39a7e4ac7a7eecec/packages/adblocker/assets/ublock-origin/resources.json",
          ),
        ]);
        const provenance = JSON.parse(fs.readFileSync(path.join(shared, "filter-provenance.json"), "utf8"));
        if (crypto.createHash("sha256").update(resourceData).digest("hex") !== provenance.files["resources.json"].sha256)
          throw Error("Unreviewed scriptlet update rejected");
        const parsed = JSON.parse(resourceData);
        if (
          !Array.isArray(parsed.scriptlets) ||
          !Array.isArray(parsed.resources)
        )
          throw Error("Invalid scriptlet resource bundle");
        const text = parts.join("\n")+"\n"+fs.readFileSync(path.join(shared,"starter.txt"),"utf8");
        const compiled=await loadFilters({filters:text,resources:resourceData,directory:app.getPath('userData')});
        const next=compiled.engine;
        await fs.promises.writeFile(resourcesFile + ".tmp",resourceData,{mode:0o600});
        await fs.promises.rename(resourcesFile + ".tmp",resourcesFile);
        await fs.promises.writeFile(filterFile + ".tmp",text,{mode:0o600});
        await fs.promises.rename(filterFile + ".tmp",filterFile);
        engine = next;
        data.filterUpdated = Date.now();
        save();
      } else if (name === "quit") app.quit();
      emit();
      return snapshot();
    } catch (err) {
      return { error: err.message };
    }
  });
  win.webContents.on("did-finish-load", async () => {
    await restoreExtensions();
    if (!tabs.length) {
      restoring = true;
      const saved = data.restoreSession
        ? safeSession(data.savedSession)
        : { urls: [], activeIndex: 0 };
      if (saved.urls.length) {
        for (const url of saved.urls) create(url);
        select(tabs[Math.min(saved.activeIndex, tabs.length - 1)].id);
      } else create();
      restoring = false;
      rememberSession();
    }
    emit();
  });
});
app.on("web-contents-created", (_e, wc) => {
  wc.on("will-attach-webview", (e) => e.preventDefault());
  wc.on("before-input-event", (e, input) => {
    if (!win || (wc !== win.webContents && !tabs.some(t => t.view.webContents === wc))) return;
    if (input.type !== "keyDown") return;
    if(wc===current()?.view.webContents && !input.control && !input.meta && !input.alt){current().addressPending=false;mediaState(current(),true);}
    const key = input.key.toLowerCase();
    if ((input.control || input.meta) && !input.alt) {
      const action = ["+", "=", "add"].includes(key) || ["Equal", "NumpadAdd"].includes(input.code) ? "in"
        : ["-", "subtract"].includes(key) || ["Minus", "NumpadSubtract"].includes(input.code) ? "out"
        : key === "0" || input.code === "Numpad0" ? "reset" : null;
      if (action) { e.preventDefault(); pageZoom(action).catch(() => {}); return; }
    }
    if ((input.control || input.meta) && input.shift && key === "n") {e.preventDefault(); create(null,true);return;}
    if ((input.control || input.meta) && input.shift && !input.alt && ['pageup','pagedown'].includes(key)) {
      e.preventDefault();moveTab(active,tabs.findIndex(t=>t.id===active)+(key==='pageup'?-1:1));return;
    }
    if ((input.control || input.meta) && input.shift && key === "r") {e.preventDefault();current()?.view.webContents.reloadIgnoringCache();return;}
    if (key === "f12" || ((input.control || input.meta) && input.shift && ["i", "j"].includes(key))) {
      e.preventDefault(); tools(); return;
    }
    if (key === "f11") {
      e.preventDefault();
      if (htmlFullscreenTab) leaveFullscreen();
      else { browserFullscreen = !win.isFullScreen(); win.setFullScreen(browserFullscreen); }
      return;
    }
    if (key === "escape" && htmlFullscreenTab) { e.preventDefault(); leaveFullscreen(); return; }
    if (input.type === "keyDown" && (input.control || input.meta)) {
      const k = input.key.toLowerCase();
      if (k === "l") {
        e.preventDefault();
        focusAddress();
      }
      if (k === "t") {
        e.preventDefault();
        if(input.shift)reopenTab();else create(null,false);
      }
      if (k === "w") {
        e.preventDefault();
        close(active);
      }
      if(k==='tab') {e.preventDefault();const at=tabs.findIndex(t=>t.id===active);select(tabs[(at+(input.shift?-1:1)+tabs.length)%tabs.length].id);}
      if(/^[1-9]$/.test(k)){e.preventDefault();const index=k==='9'?tabs.length-1:Number(k)-1;if(tabs[index])select(tabs[index].id);}
    }
  });
});
app.on("window-all-closed", () => app.quit());
