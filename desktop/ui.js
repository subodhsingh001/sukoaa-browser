// SPDX-License-Identifier: GPL-3.0-or-later
document.documentElement.dataset.platform = window.aegis.platform;
const iconPaths = {
  brand: "M12 2 21 6v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",
  back: "m15 18-6-6 6-6",
  forward: "m9 18 6-6-6-6",
  reload: "M20 11a8 8 0 1 0-2.3 6.5M20 4v7h-7",
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  plus: "M12 5v14M5 12h14",
  private:
    "M9 3h6l2 7H7l2-7ZM4 10h16M3 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM15 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM9 17h6",
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  shield: "M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5",
  library: "M4 3h4v18H4V3ZM12 3h4v18h-4V3ZM20 4l3 16",
  history: "M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  appearance: "M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9ZM12 3v18",
  lock: "M6 10h12v11H6V10ZM8 10V7a4 4 0 0 1 8 0v3M12 14v3",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  check: "m5 12 4 4L19 6",
  youtube:
    "M21 8c0-2-1-3-3-3H6C4 5 3 6 3 8v8c0 2 1 3 3 3h12c2 0 3-1 3-3V8ZM10 9l5 3-5 3V9Z",
  audio: "M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  muted: "M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6",
  globe:
    "M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  code: "m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  mail: "M3 5h18v14H3V5Zm0 0 9 8 9-8",
};
function makeIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(svg.namespaceURI, "path");
  p.setAttribute("d", iconPaths[name] || iconPaths.globe);
  svg.append(p);
  return svg;
}
let state,
  opened = false,
  view = "protection";
const $ = (id) => document.getElementById(id);
let toastTimer;
function toast(text) {
  clearTimeout(toastTimer);
  $("toast").textContent = text;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3500);
}
async function command(name, arg) {
  const result = await window.aegis.command(name, arg);
  if (result?.error) {
    toast(result.error);
    return;
  }
  if (result?.tabs) render(result);
  return result;
}
function hostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
function entries(id, list, kind) {
  const box = $(id);
  box.replaceChildren();
  const term = $("librarySearch").value.trim().toLowerCase();
  const filtered = list.filter(
    (item) =>
      kind === "downloads" ||
      !term ||
      ((item.title || "") + " " + (item.url || ""))
        .toLowerCase()
        .includes(term),
  );
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = term
      ? "No matching pages."
      : kind === "bookmarks"
        ? "Keep your favourites close. Bookmark a page to save it here."
        : kind === "downloads"
          ? "Your downloads will appear here during this session."
          : "Your recent visits will appear here.";
    box.append(empty);
    return;
  }
  for (const item of filtered.slice(0, 60)) {
    const row = document.createElement("div");
    row.className = "entry";
    const b = document.createElement("button"),
      text = document.createElement("span"),
      title = document.createElement("span"),
      url = document.createElement("span");
    text.className = "entry-text";
    title.className = "entry-title";
    title.textContent = item.title || item.url || item.name;
    url.className = "entry-url";
    url.textContent = item.url
      ? hostname(item.url)
      : item.total
        ? Math.round(item.received / 1024) +
          " / " +
          Math.round(item.total / 1024) +
          " KB"
        : "";
    text.append(title, url);
    b.append(makeIcon(kind === "downloads" ? "download" : "globe"), text);
    b.title = item.url || item.name;
    b.onclick = () => {
      if (item.url) {
        command("navigate", item.url);
        panel(false);
      }
    };
    row.append(b);
    if (kind === "bookmarks" || kind === "history") {
      const del = document.createElement("button");
      del.append(makeIcon("close"));
      del.setAttribute("aria-label", kind === "history" ? "Delete visit: " + (item.title || item.url) : "Remove bookmark");
      del.title = kind === "history" ? "Delete this visit" : "Remove bookmark";
      del.onclick = () => command(kind === "history" ? "removeHistory" : "removeBookmark", kind === "history" ? item.id : item.url);
      row.append(del);
    }
    if (kind === "downloads") {
      const status = document.createElement("small");
      status.textContent = item.status;
      row.append(status);
    }
    box.append(row);
  }
}
function renderTabList(s) {
  const box = $("tabOverview");
  box.replaceChildren();
  const term = $("tabSearch").value.trim().toLowerCase();
  const matching = s.tabs.filter(tab => !term || `${tab.title} ${tab.url} ${tab.private ? "private" : "regular"}`.toLowerCase().includes(term));
  for (const tab of matching) {
    const row = document.createElement("div");
    row.className = "entry" + (tab.id === s.active ? " selected-tab" : "");
    const open = document.createElement("button");
    open.append(tabBadge(tab));
    const text = document.createElement("span"); text.className = "entry-text";
    const title = document.createElement("span"); title.className = "entry-title";
    title.textContent = (tab.id === s.active ? "● " : "") + tab.title;
    const detail = document.createElement("span"); detail.className = "entry-url";
    detail.textContent = `${tab.private ? "Private" : "Regular"} · ${tab.url || "New tab"}`;
    text.append(title, detail); open.append(text);
    open.title = detail.textContent;
    open.onclick = async () => { await command("select", tab.id); panel(false); };
    const close = document.createElement("button"); close.append(makeIcon("close"));
    close.title = "Close tab"; close.setAttribute("aria-label", "Close tab: " + tab.title);
    close.onclick = () => command("close", tab.id);
    row.append(open, close); box.append(row);
  }
  if (!matching.length) box.textContent = "No matching tabs.";
  $("tabCount").textContent = String(s.tabs.length);
}
function tabBadge(tab) {
  const badge=document.createElement('span');badge.className='tab-monogram';
  if(tab.favicon?.startsWith('data:image/png;base64,')) {
    const image=document.createElement('img');image.src=tab.favicon;image.alt='';
    image.onerror=()=>badge.replaceChildren(makeIcon(tab.private?'private':'globe'));
    badge.append(image);
  } else if(tab.private || !tab.url)badge.append(makeIcon(tab.private?'private':'brand'));
  else badge.textContent=(hostname(tab.url).replace(/^www\./,'') || 'S')[0].toUpperCase();
  return badge;
}
let lastActiveTab, addressTabId;
function renderTabs(s) {
  const box=$('tabs'),known=new Map([...box.children].map(node=>[node.dataset.tabId,node]));
  s.tabs.forEach((tab,index)=>{
    let wrap=known.get(tab.id);known.delete(tab.id);
    if(!wrap) {
      wrap=document.createElement('div');wrap.dataset.tabId=tab.id;
      const open=document.createElement('button');open.setAttribute('role','tab');
      const title=document.createElement('span');title.className='tab-title';open.append(document.createElement('span'),title);
      open.onclick=()=>command('select',tab.id);
      const audio=document.createElement('button');audio.className='tab-audio';audio.onclick=()=>command('muteTab',tab.id);
      const close=document.createElement('button');close.className='close';close.append(makeIcon('close'));close.title='Close tab';close.onclick=()=>command('close',tab.id);
      wrap.append(open,audio,close);
      wrap.oncontextmenu=e=>{e.preventDefault();command('tabMenu',tab.id);};
      wrap.onauxclick=e=>{if(e.button===1){e.preventDefault();command('close',tab.id);}};
    }
    wrap.className='tab'+(tab.id===s.active?' active':'')+(tab.loading?' tab-loading':'');
    const [open,audio,close]=wrap.children;
    open.setAttribute('aria-selected',String(tab.id===s.active));
    open.title=tab.url?`${tab.title}\n${tab.url}${tab.private?'\nPrivate tab':''}`:`${tab.title} · Tab ${index+1}\nStart typing in the address bar`;
    open.setAttribute('aria-label',open.title);
    const badgeKey=`${tab.favicon || ''}|${tab.private}|${hostname(tab.url)}`;
    if(open.dataset.badgeKey!==badgeKey){open.firstElementChild.replaceWith(tabBadge(tab));open.dataset.badgeKey=badgeKey;}
    open.querySelector('.tab-title').textContent=(tab.private?'Private · ':'')+tab.title;
    audio.hidden=!tab.muted&&!tab.audible;audio.title=tab.muted?'Unmute tab':'Mute tab';audio.setAttribute('aria-label',audio.title);
    const audioKey=String(tab.muted);if(audio.dataset.muted!==audioKey){audio.replaceChildren(makeIcon(tab.muted?'muted':'audio'));audio.dataset.muted=audioKey;}
    close.setAttribute('aria-label','Close '+tab.title);
    if(box.children[index]!==wrap)box.insertBefore(wrap,box.children[index] || null);
  });
  for(const node of known.values())node.remove();
  if(lastActiveTab!==s.active){[...box.children].find(node=>node.dataset.tabId===s.active)?.scrollIntoView({block:'nearest',inline:'nearest'});lastActiveTab=s.active;}
}
function render(s) {
  const activeChanged=addressTabId!==s.active;
  addressTabId=s.active;
  state = s;
  if(opened&&view==='tabs')renderTabList(s);
  const t = s.tabs.find((x) => x.id === s.active);
  renderTabs(s);
  $('reopenTab').disabled=!s.canReopen;
  if (t) {
    $("zoomReset").textContent = `${t.zoom || 100}%`;
    $("zoomOut").disabled = t.zoom <= 25;
    $("zoomIn").disabled = t.zoom >= 500;
    document.body.classList.toggle("private-active", !!t.private);
    $("liteMode").textContent = t.lite ? "Disable Lite mode for this tab" : "Enable Lite mode for this tab";
    $("performanceReadout").textContent = `Last page load: ${t.loadMs || 0} ms · ${t.liteBlocked || 0} image/media requests blocked by Lite mode. Includes page/server/network time; this is not a browser benchmark.`;
    $("private").setAttribute("aria-pressed", String(!!t.private));
    $("deviceBar").hidden = !!s.lab || !t.device || t.device === "desktop";
    if (t.device && t.device !== "desktop") $("devicePreset").value = t.device;
    $("developer").setAttribute("aria-pressed", String(t.devtools === true));
    if (activeChanged || document.activeElement !== $("address"))
      $("address").value = t.url || "";
    $("count").textContent = t.blocked;
    $("pageBlocked").textContent = t.blocked.toLocaleString();
    $("back").disabled = !t.back;
    $("forward").disabled = !t.forward;
    $("security").replaceChildren(
      makeIcon(t.url.startsWith("https:") ? "lock" : "globe"),
    );
    $("security").className = t.url.startsWith("https:")
      ? "secure"
      : t.url.startsWith("http:")
        ? "insecure"
        : "";
    $("security").title = t.url.startsWith("https:")
      ? "HTTPS connection"
      : t.url.startsWith("http:")
        ? "Unencrypted HTTP connection"
        : "New tab";
    $("loading").hidden = !t.loading;
    $("status").textContent = t.error
      ? "Page error: " + t.error
      : t.loading
        ? "Loading…"
        : `${s.total.toLocaleString()} requests blocked this session · ${t.private ? "Private · HTTP cache off · extensions off" : "Local filtering"}`;
    $("shield").title = $("status").textContent;
    const host = hostname(t.url),
      paused = s.settings.exceptions.includes(host);
    $("site").textContent = host || "New tab";
    $("toggleShield").textContent = paused
      ? "Enable protection on this website"
      : "Pause protection on this website";
    $("toggleShield").disabled = !host;
    $("shield").classList.toggle("paused", paused);
    $("shieldBadge").textContent = paused ? "Paused" : "Active";
    $("protectionStatus").textContent = paused
      ? "Filtering is paused on this website."
      : "Your filters run on this device.";
    $("bookmark").classList.toggle(
      "saved",
      s.settings.bookmarks.some((b) => b.url === t.url),
    );
  }
  renderLabBar(s);
  if(!opened)return;
  if(view==='updates')renderUpdates(s);
  if(view==='repair')renderRepair(s);
  if(view==='lab')renderLabReport(s);
  if(view==='tools') {
  const extensionBox = $("extensions"); extensionBox.replaceChildren();
  for (const ext of s.extensions || []) {
    const row = document.createElement("div");row.className="extension-row";
    const name = document.createElement("span");name.textContent=`${ext.name} ${ext.version || ""}${ext.error ? " — Unavailable: " + ext.error : ""}`;
    const open = document.createElement("button");open.textContent="Open";open.disabled=!ext.page || !!ext.error;open.onclick=()=>command("extensionOpen",ext.id);
    const remove = document.createElement("button");remove.textContent="Remove";remove.onclick=async()=>{await command("extensionRemove",ext.id);toast("Removed. Reload open pages to remove injected content scripts.");};
    row.append(name,open,remove);extensionBox.append(row);
  }
  if (!(s.extensions || []).length) extensionBox.textContent="No extensions added.";
  }
  if(view==='permissions') {
  $("permissionScope").textContent = s.permissions?.private ? 'Private tab only — discarded when this tab closes.' : 'Normal browsing — saved site choices. Session grants clear when the browser closes.';
  const sites=$("permissionSites");sites.replaceChildren();
  for(const row of s.permissions?.sites || []) {
    const card=document.createElement('div');card.className='permission-site';
    const heading=document.createElement('h3');heading.textContent=row.origin;card.append(heading);
    for(const kind of ['camera','microphone','location']) {
      const label=document.createElement('label');label.textContent=kind[0].toUpperCase()+kind.slice(1)+' ';
      const select=document.createElement('select');select.setAttribute('aria-label',kind+' for '+row.origin);
      for(const value of ['ask','allow','block']) {const option=document.createElement('option');option.value=value;option.textContent=value[0].toUpperCase()+value.slice(1);select.append(option);}
      select.value=row[kind];select.onchange=()=>command('permissionSet',{origin:row.origin,kind,value:select.value});label.append(select);card.append(label);
    }
    sites.append(card);
  }
  if(!sites.children.length)sites.textContent='Open an HTTPS website to configure its permissions.';
  }
  $("search").value = s.settings.search;
  $("startup").value = s.settings.restoreSession === false ? "new" : "restore";
  $("youtubeProtection").checked = s.settings.youtubeProtection !== false;
  $("strict").checked = s.settings.strict;
  $("focus").checked = s.settings.focus;
  $("filterDate").textContent = s.settings.filterUpdated
    ? "Last updated " + new Date(s.settings.filterUpdated).toLocaleString()
    : "Bundled EasyList + EasyPrivacy. Update periodically.";
  $("bookmarkCount").textContent = s.settings.bookmarks.length;
  document.querySelectorAll("[data-theme]").forEach((b) => {
    b.classList.toggle(
      "selected",
      b.dataset.theme === (s.settings.theme || "dark"),
    );
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.theme === (s.settings.theme || "dark")),
    );
  });
  if(view==='library'){entries("bookmarks", s.settings.bookmarks, "bookmarks");entries("history", s.settings.history, "history");}
  if(view==='downloads')entries("downloads", s.downloads, "downloads");
}
function setView(next) {
  view = next;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("selected", b.dataset.view === view));
  document
    .querySelectorAll("[data-page]")
    .forEach((p) => (p.hidden = p.dataset.page !== view));
  $("panelTitle").textContent = {
    updates: "About & updates",
    repair: "Fix this page",
    lab: "Comparison Lab",
    permissions: "Site permissions",
    legal: "Privacy & licenses",
    tabs: "Open tabs",
    protection: "Protection",
    library: "Your library",
    downloads: "Downloads",
    appearance: "Appearance",
    tools: "Tools & extensions",
  }[view];
  if(opened&&state)render(state);
}
function panel(value, next) {
  if (next) setView(next);
  opened = value;
  $("panel").hidden = !value;
  command("panel", value);
  if(value&&state)render(state);
  if (value) $("dismiss").focus();
}
$("addressForm").onsubmit = (e) => {
  e.preventDefault();
  command("navigate", $("address").value);
  panel(false);
  $("address").blur();
};
for (const id of ["back", "forward", "reload", "home"])
  $(id).onclick = () => {
    command(id);
    panel(false);
  };
$("new").onclick = () => {
  command("new");
  panel(false);
};
$("private").onclick = () => {
  command("new", true);
  panel(false);
};
$("bookmark").onclick = () => {
  if (!state?.tabs.find((t) => t.id === state.active)?.url) {
    toast("Open a website to bookmark it.");
    return;
  }
  command("bookmark");
  toast("Saved to your bookmarks");
};
$("menu").onclick = () => panel(!opened);
$("tabMenu").onclick = () => { panel(true, "tabs"); $("tabSearch").focus(); };
$("tabSearch").oninput = () => { if (state) renderTabList(state); };
$("overviewNew").onclick = () => { command("new"); panel(false); };
$("overviewPrivate").onclick = () => { command("new", true); panel(false); };
$("shield").onclick = () => panel(true, "protection");
$("dismiss").onclick = () => panel(false);
$("toggleShield").onclick = () => command("shield");
$("search").onchange = () => command("settings", { search: $("search").value });
$("strict").onchange = () =>
  command("settings", { strict: $("strict").checked });
$("focus").onchange = () => command("settings", { focus: $("focus").checked });
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
document
  .querySelectorAll("[data-theme]")
  .forEach(
    (b) => (b.onclick = () => command("settings", { theme: b.dataset.theme })),
  );
$("librarySearch").oninput = () => {
  if (state) render(state);
};
$("update").onclick = async () => {
  $("update").disabled = true;
  $("update").textContent = "Updating…";
  const result = await command("update");
  $("update").disabled = false;
  $("update").replaceChildren(
    document.createTextNode("Update filter lists"),
    makeIcon("reload"),
  );
  if (result) toast("Filters updated. Reload YouTube to apply the new rules.");
};
$("startup").onchange = () =>
  command("settings", { restoreSession: $("startup").value === "restore" });
$("youtubeProtection").onchange = () =>
  command("settings", { youtubeProtection: $("youtubeProtection").checked });
$("clear").onclick = () => $("clearDialog").showModal();
$("cancelClear").onclick = () => $("clearDialog").close();
$("clearForm").onsubmit = async (event) => {
  event.preventDefault();
  $("confirmClear").disabled = true;
  try {
    const result = await command("clear", {
      history: $("clearHistory").checked,
      cache: $("clearCache").checked,
      cookies: $("clearCookies").checked,
      session: $("clearSession").checked,
    });
    if (result) {
      $("clearDialog").close();
      toast("Selected browsing data cleared");
    }
  } finally {
    $("confirmClear").disabled = false;
  }
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && opened && !$("clearDialog").open) panel(false);
});
window.aegis.onState(render);
window.aegis.onClosePanel(() => {opened=false;$("panel").hidden=true;});
window.aegis.onFocus((request) => {
  if(request){addressTabId=request.id;$("address").value=request.value || "";}
  $("address").focus();
  $("address").select();
});
command("state");

$("developer").onclick = () => { panel(false); command("devtools"); };
$("mobilePreview").onclick = () => { panel(false); command("device", "phone"); };
$("devicePreset").onchange = () => command("device", $("devicePreset").value);
$("exitDevice").onclick = () => command("device", "desktop");

$("newPrivateTool").onclick=()=>{command("new",true);panel(false);};
$("cleanTest").onclick=()=>{command("cleanTest");panel(false);};
$("hardReload").onclick=()=>{command("hardReload");panel(false);};
$("liteMode").onclick=()=>command("lite");
$("extensionInstall").onclick=async()=>{const b=$("extensionInstall");b.disabled=true;try{await command("extensionInstall");}finally{b.disabled=false;}};

for (const action of ['windowMinimize','windowMaximize','windowClose']) {
  document.getElementById(action).onclick = () => window.aegis.command(action);
}

for (const [id, action] of [["zoomIn", "in"], ["zoomOut", "out"], ["zoomReset", "reset"], ["zoomFit", "fit"]])
  $(id).onclick = () => command("zoom", action);

document.querySelectorAll("[data-legal]").forEach(button => button.onclick = async () => {
  const result = await command("legal", button.dataset.legal);
  if (result?.legal) $("legalText").textContent = result.legal;
});

$("permissionReset").onclick=()=>command("permissionReset");
$('reopenTab').onclick=()=>{panel(false);command('reopen');};

const repairGuides={
 load:'Check page errors and blocked requests below. A clean session can help distinguish saved-site-data problems from other causes.',
 video:'Blocked scripts or media may affect playback. Try the short filter test, then Undo if it does not help. Engine support and site restrictions can also affect playback.',
 popup:'If you blocked a link-opening prompt, you can open that recent link below. This does not enable automatic popups for the website.',
 copy:'Return to the website, then click its Copy button. Copy requires page focus. Ctrl+C and Ctrl+V remain available; automatic clipboard reading stays blocked.',
 permission:'Use Site permissions to choose Ask, Allow or Block. Your operating system can also deny camera, microphone or location access.'
};
function renderRepair(s) {
 const r=s.repair,t=s.tabs.find(t=>t.id===s.active);$('repairSite').textContent=r?.site || 'Open an HTTPS website or localhost to run a temporary test.';
 $('repairGuidance').textContent=repairGuides[$('repairIssue').value];
 const messages=[r?.savedPaused?'Protection already has a saved exception for this website. Change it in Protection if needed.':'Protection has no saved exception for this website.',r?.error?'Page error: '+r.error:'No page-load error reported.',`${t?.blocked || 0} requests blocked on this page. Blocking alone does not prove it caused a problem.`,r?.active?'Lite mode is temporarily bypassed for this test.':r?.lite?'Lite mode is enabled; it can hide media and images.':'Lite mode is off.'];
 const box=$('repairSummary');box.replaceChildren();for(const text of messages){const p=document.createElement('p');p.textContent=text;box.append(p);}
 if(r)for(const [kind,count] of Object.entries(r.blocked || {})){const line=document.createElement('span');line.className='repair-chip';line.textContent=kind+': '+count;box.append(line);}
 $('repairPause').disabled=!r?.site || r.active || r.savedPaused;$('repairUndo').disabled=!r?.active;
 $('repairTemporary').textContent=r?.active?'Temporary test active until '+new Date(r.until).toLocaleTimeString()+'. Undo restores filtering and reloads this tab.':'No temporary filter test is active.';
 $('repairOpenPopup').disabled=!r?.popupHost;$('repairOpenPopup').textContent=r?.popupHost?'Open blocked link · '+r.popupHost:'No recent blocked link';
 const events=$('repairEvents');events.replaceChildren();for(const item of r?.events || []){const p=document.createElement('p');p.textContent=new Date(item.time).toLocaleTimeString()+' · '+item.detail;events.append(p);}if(!events.children.length)events.textContent='No recent permission or popup decisions for this page.';
}
function renderLabBar(s){
 $('labBar').hidden=!s.lab||opened;
 document.querySelectorAll('[data-lab-index]').forEach(b=>{const id=s.lab?.ids[Number(b.dataset.labIndex)];b.setAttribute('aria-pressed',String(id===s.active));});
}
function renderLabReport(s) {
 $('labStart').disabled=!!s.lab||!s.tabs.find(t=>t.id===s.active)?.url;
 $('labMeasure').disabled=!s.lab;$('labClose').disabled=!s.lab;
 const box=$('labReport');box.replaceChildren();if(!s.lab){box.textContent='Open a website, then start a comparison.';return;}
 if(!s.lab.report.length){box.textContent='Comparison is open. Wait for the pages to load, then refresh these details.';return;}
 const table=document.createElement('table'),head=document.createElement('tr');for(const title of ['Measure',...s.lab.report.map(r=>r.label)]){const th=document.createElement('th');th.textContent=title;head.append(th);}table.append(head);
 for(const [title,key] of [['Site','origin'],['Viewport width','width'],['Page load · ms','loadMs'],['Resource entries','resources'],['Requests blocked','blocked'],['Local storage keys','localKeys'],['Session storage keys','sessionKeys'],['Visible cookies','visibleCookies'],['Permissions','permissions']]){
   const row=document.createElement('tr'),label=document.createElement('th');label.textContent=title;row.append(label);
   for(const report of s.lab.report){const cell=document.createElement('td');cell.textContent=report.loading?'Loading / unavailable':String(report[key]??'Unavailable');row.append(cell);}table.append(row);
 }box.append(table);
}
$('repairIssue').onchange=()=>{if(state)renderRepair(state);};
$('repairFocus').onclick=()=>command('repairFocus');
$('repairPermissions').onclick=()=>setView('permissions');
$('repairOpenPopup').onclick=()=>command('repairPopup');
for(const id of ['repairPause','repairUndo'])$(id).onclick=()=>command(id);
$('labStart').onclick=()=>command('labStart');
$('labMeasure').onclick=()=>command('labMeasure');
$('labClose').onclick=()=>command('labClose');
$('labExit').onclick=()=>command('labClose');
$('labDetails').onclick=async()=>{await command('labMeasure');panel(true,'lab');};
for(const b of document.querySelectorAll('[data-lab-index]'))b.onclick=()=>{const id=state?.lab?.ids[Number(b.dataset.labIndex)];if(id)command('select',id);};

function renderUpdates(s){
 const r=s.runtime || {},u=s.updates || {};
 $('runtimeVersion').textContent=`Sukoaa ${r.version || ''} · Electron ${r.electron || ''} · Chromium ${r.chromium || ''}`;
 $('filterStartup').textContent=`Filter initialization: ${r.filters?.elapsedMs || 0} ms · ${r.filters?.source || 'pending'}. This is not a website speed benchmark.`;
 const labels={disabled:'Verified updates are not configured for this build. Install replacement packages only from a source you trust.',ready:'Ready to check the configured release channel.',checking:'Checking signed release information…',available:`Verified release ${u.version} is available.`,current:'This build is current for the configured channel.',downloading:`Downloading verified release… ${Math.round((u.downloadedBytes || 0)/1048576)} MB`,downloaded:`Verified download saved: ${u.savedFile || ''}. Close Sukoaa before running the installer.`,error:u.error || 'Update check failed.'};
 $('updateStatus').textContent=labels[u.status] || 'Update status unavailable.';
 $('updateNotes').textContent=u.notes || '';
 const busy=['checking','downloading'].includes(u.status);
 $('checkApplicationUpdate').disabled=!u.configured || busy;
 $('downloadApplicationUpdate').hidden=!u.available;
 $('downloadApplicationUpdate').disabled=busy;
}
$('checkApplicationUpdate').onclick=()=>command('applicationUpdateCheck');
$('downloadApplicationUpdate').onclick=()=>command('applicationUpdateDownload');
