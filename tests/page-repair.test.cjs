const test=require('node:test'),assert=require('node:assert/strict');
const {PageRepair}=require('../desktop/page-repair.cjs');
test('filter trials are scoped to one tab/origin and expire without saved settings',()=>{
 let now=1000;const p=new PageRepair(()=>now),a={url:'https://site.test/a'},b={url:a.url};
 p.start(a);assert(p.active(a));assert(!p.active(b));a.url='https://site.test/b';p.navigated(a,a.url);assert(p.active(a));
 a.url='https://other.test';p.navigated(a,a.url);assert(!p.active(a));
 p.start(a);now+=300001;assert(!p.active(a));assert.throws(()=>p.start({url:'http://remote.test'}));
});
test('diagnostic counts and bounded observations are discarded on navigation/close',()=>{
 const p=new PageRepair(),tab={url:'https://site.test'};p.block(tab,'script');p.block(tab,'anything');
 for(let i=0;i<30;i++)p.note(tab,'permission','denied');assert.equal(p.describe(tab).events.length,12);
 assert.deepEqual(p.describe(tab).blocked,{script:1,other:1});p.navigated(tab,tab.url);assert.deepEqual(p.describe(tab).blocked,{});
 p.start(tab);p.forget(tab);assert(!p.active(tab));
});
test('popup retry requires an observed current-site HTTP(S) link and expires',()=>{
 let now=0;const p=new PageRepair(()=>now),tab={url:'https://site.test'};
 for(const value of ['javascript:alert(1)','file:///tmp/file','https://u:p@evil.test'])p.popup(tab,value);
 assert.equal(p.popupURL(tab),'');p.popup(tab,'https://article.test/story');assert.equal(p.describe(tab).popupHost,'article.test');
 now=300001;assert.equal(p.popupURL(tab),'');now=0;tab.url='https://other.test';assert.equal(p.popupURL(tab),'');
});
