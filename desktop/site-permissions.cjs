// SPDX-License-Identifier: GPL-3.0-or-later
const kinds = ['camera', 'microphone', 'location'];
function origin(value) {
  try { const u = new URL(value); return u.protocol === 'https:' ||
    (u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)) ? u.origin : ''; }
  catch { return ''; }
}
function requested(permission, details = {}) {
  if (permission === 'geolocation' || permission === 'geolocation-approximate') return ['location'];
  if (permission !== 'media') return [];
  const media = details.mediaTypes || (details.mediaType ? [details.mediaType] : []);
  if (!media.length || media.some(v=>!['audio','video'].includes(v))) return [];
  return [...new Set(media.map(v=>v === 'video' ? 'camera' : 'microphone'))];
}
class SitePermissions {
  constructor({saved, save, find, active, prompt, changed}) {
    Object.assign(this, {saved, save, find, active, prompt, changed});
    this.temporary = new WeakMap(); this.pending = new Set(); this.epoch = 0;
  }
  store(tab) {
    const ses = tab.view.webContents.session;
    if (!this.temporary.has(ses)) this.temporary.set(ses, {});
    return this.temporary.get(ses);
  }
  get(tab, site, kind) {
    return this.store(tab)[site]?.[kind] || (!tab.private && this.saved()[site]?.[kind]) || 'ask';
  }
  context(wc, url) {
    const tab = this.find(wc), site = origin(url);
    return tab && !tab.closed && !wc.isDestroyed() && site && site === origin(wc.getURL()) ? {tab, site} : null;
  }
  check(wc, permission, requestingOrigin, details = {}) {
    const c = wc && this.context(wc, requestingOrigin);
    const list = requested(permission, details);
    return !!c && details.isMainFrame !== false && list.length > 0 && list.every(k=>this.get(c.tab,c.site,k)==='allow');
  }
  async request(wc, permission, callback, details = {}) {
    let done = false; const finish = allow=>{ if (!done) { done=true; callback(!!allow); } };
    const c = this.context(wc, details.requestingUrl);
    const list = requested(permission, details);
    if (!c || !details.isMainFrame || !list.length || this.active() !== c.tab || this.pending.has(wc)) {finish(false);return;}
    if (list.some(k=>this.get(c.tab,c.site,k)==='block')) {finish(false);return;}
    if (list.every(k=>this.get(c.tab,c.site,k)==='allow')) {finish(true);return;}
    this.pending.add(wc); const epoch=this.epoch; const document=wc.getURL(); const revision=c.tab.permissionRevision || 0;
    try {
      const result=await this.prompt({type:'question', title:'Site permission — Sukoaa',
        message:`${c.site} wants to use your ${list.join(' and ')}.`,
        detail:c.tab.private ? 'Private tab: decisions are discarded when this tab closes.' : 'Allow only websites you trust. You can change this under Site permissions.',
        buttons:c.tab.private ? ['Allow for this private tab','Block for this private tab','Not now'] : ['Allow for this session','Always allow','Block','Not now'],
        defaultId:c.tab.private ? 2 : 3, cancelId:c.tab.private ? 2 : 3, noLink:true});
      if (epoch!==this.epoch || this.active()!==c.tab || !this.context(wc,c.site) || wc.getURL()!==document || (c.tab.permissionRevision || 0)!==revision) {finish(false);return;}
      const allow=c.tab.private ? result.response===0 : result.response<2;
      const block=c.tab.private ? result.response===1 : result.response===2;
      if (allow || block) {
        const target=!c.tab.private && result.response!==0 ? this.saved() : this.store(c.tab);
        target[c.site] ||= {};
        for(const kind of list) target[c.site][kind]=allow?'allow':'block';
        if(target===this.saved()) this.save();
      }
      finish(allow); this.changed();
    } catch {finish(false);} finally {this.pending.delete(wc);}
  }
  rows(tab) {
    if(!tab) return {private:false,origin:'',sites:[]};
    const normal=tab.private?{}:this.saved(); const temp=this.store(tab);
    const current=origin(tab.view.webContents.getURL());
    const sites=[...new Set([...Object.keys(normal),...Object.keys(temp),...(current?[current]:[])])].filter(v=>origin(v)===v);
    return {private:tab.private,origin:current,sites:sites.sort().map(site=>({origin:site,...Object.fromEntries(kinds.map(k=>[k,this.get(tab,site,k)]))}))};
  }
  set(tab, site, kind, value) {
    if(!tab || origin(site)!==site || !kinds.includes(kind) || !['ask','allow','block'].includes(value)) throw Error('Invalid site permission');
    this.epoch++;
    const temp=this.store(tab); if(temp[site]) delete temp[site][kind];
    const store=tab.private?temp:this.saved(); store[site] ||= {};
    if(value==='ask')delete store[site][kind];else store[site][kind]=value;
    if(!Object.keys(store[site]).length)delete store[site];
    if(!tab.private)this.save();
  }
  reset(tab) {
    this.epoch++;this.temporary.delete(tab.view.webContents.session);
    if(!tab.private){for(const key of Object.keys(this.saved()))delete this.saved()[key];this.save();}
  }
}
module.exports={SitePermissions,origin,requested};
