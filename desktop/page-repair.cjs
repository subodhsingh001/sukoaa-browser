// SPDX-License-Identifier: GPL-3.0-or-later
const {origin}=require('./site-permissions.cjs');
class PageRepair {
  constructor(now=Date.now){this.now=now;this.states=new WeakMap();}
  get(tab){if(!this.states.has(tab))this.states.set(tab,{events:[],blocked:{},until:0,site:'',popup:null});return this.states.get(tab);}
  note(tab,type,detail){if(!tab)return;const s=this.get(tab);s.events.unshift({type,detail:String(detail).slice(0,160),time:this.now()});s.events=s.events.slice(0,12);}
  block(tab,type){const s=this.get(tab),key=['script','image','media','xmlHttpRequest','subFrame','stylesheet'].includes(type)?type:'other';s.blocked[key]=(s.blocked[key] || 0)+1;}
  active(tab){if(!tab)return false;const s=this.get(tab);return s.until>this.now()&&s.site===origin(tab.url);}
  start(tab){const site=origin(tab.url);if(!site)throw Error('Open an HTTPS website or localhost first.');const s=this.get(tab);s.site=site;s.until=this.now()+300000;return s.until;}
  stop(tab){const s=this.get(tab);s.until=0;s.site='';}
  navigated(tab,url){const s=this.get(tab);s.events=[];s.blocked={};s.popup=null;if(s.site!==origin(url))this.stop(tab);}
  popup(tab,url){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return;this.get(tab).popup={url:u.href,site:origin(tab.url),at:this.now()};this.note(tab,'popup','A request to open '+u.hostname+' was blocked.');}catch{}}
  popupURL(tab){const p=this.get(tab).popup;return p&&p.site===origin(tab.url)&&this.now()-p.at<300000?p.url:'';}
  describe(tab){if(!tab)return null;const s=this.get(tab);return {site:origin(tab.url),active:this.active(tab),until:s.until,blocked:s.blocked,events:s.events,popupHost:this.popupURL(tab)?new URL(s.popup.url).hostname:'',error:tab.error || '',lite:!!tab.lite};}
  forget(tab){this.states.delete(tab);}
}
module.exports={PageRepair};
