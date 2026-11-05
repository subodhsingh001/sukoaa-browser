// SPDX-License-Identifier: GPL-3.0-or-later
function pageLabel(title, url, priv = false) {
  if (!/^https?:\/\//i.test(url || '')) return priv ? 'Private tab' : 'New tab';
  return String(title || '').trim().slice(0, 180) || new URL(url).hostname;
}
function faviconURL(value, page) {
  try {
    const u = new URL(value), base = new URL(page);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password &&
      u.origin === base.origin ? u.href : '';
  } catch { return ''; }
}
class ClosedTabs {
  constructor() { this.items = []; }
  remember(tab, index) {
    if (tab.private || !/^https?:\/\//i.test(tab.url || '')) return;
    try { const u = new URL(tab.url); if(u.username || u.password)return; } catch { return; }
    this.items.push({url:tab.url,index});
    if(this.items.length>15)this.items.shift();
  }
  take() { return this.items.pop(); }
  clear() { this.items.length=0; }
}
// Move an existing tab to its final index without recreating its session/view.
function reorderTabs(tabs,id,index) {
  if(typeof id!=='string'||!Number.isInteger(index)||index<0||index>=tabs.length)return false;
  const from=tabs.findIndex(tab=>tab.id===id);
  if(from<0||from===index)return false;
  tabs.splice(index,0,tabs.splice(from,1)[0]);
  return true;
}
module.exports={pageLabel,faviconURL,ClosedTabs,reorderTabs};
