const test=require('node:test'),assert=require('node:assert/strict');
const {pageLabel,faviconURL,ClosedTabs,reorderTabs}=require('../desktop/tab-tools.cjs');
const {sessionFromTabs}=require('../shared/core.cjs');
test('tab moves preserve views, both directions, and normal session order without private URLs',()=>{
  const a={id:'a',url:'https://a.example',view:{}},p={id:'p',private:true,url:'https://private.example',view:{}},b={id:'b',url:'https://b.example',view:{}},c={id:'c',url:'https://c.example',view:{}};
  const tabs=[a,p,b,c],originalViews=tabs.map(t=>t.view);
  assert(reorderTabs(tabs,'a',3));assert.deepEqual(tabs,[p,b,c,a]);
  assert.deepEqual(sessionFromTabs(tabs,'b'),{urls:['https://b.example/','https://c.example/','https://a.example/'],activeIndex:0});
  assert(reorderTabs(tabs,'a',0));assert.deepEqual(tabs,[a,p,b,c]);
  assert(reorderTabs(tabs,'p',3));assert.deepEqual(tabs,[a,b,c,p]);
  assert.deepEqual(sessionFromTabs(tabs,'c'),{urls:['https://a.example/','https://b.example/','https://c.example/'],activeIndex:2});
  for(const tab of [a,p,b,c])assert.equal(tab.view,originalViews[[a,p,b,c].indexOf(tab)]);
  for(const [id,index]of [['a',0],['missing',1],['a',-1],['a',4],['a',1.5],['a','1'],[null,1]]){const before=[...tabs];assert.equal(reorderTabs(tabs,id,index),false);assert.deepEqual(tabs,before);}
});
test('tab labels distinguish blank/private pages and fall back to host',()=>{
  assert.equal(pageLabel('', 'https://youtube.com/watch?v=x'),'youtube.com');
  assert.equal(pageLabel('Long title','https://example.com'),'Long title');
  assert.equal(pageLabel('New tab','file:///home.html',true),'Private tab');
  assert.equal(pageLabel('anything',''),'New tab');
});
test('icons stay on the page origin and reject redirects to local or credential URLs',()=>{
  assert.equal(faviconURL('https://youtube.com/icon.png','https://youtube.com/watch'),'https://youtube.com/icon.png');
  for(const url of ['https://evil.test/icon','http://youtube.com/icon','file:///etc/passwd','data:image/png,xxx','https://u:p@youtube.com/icon','http://127.0.0.1/icon'])assert.equal(faviconURL(url,'https://youtube.com/watch'),'');
});
test('recently closed tabs are bounded, session-only, exclude private pages and clear',()=>{
  const list=new ClosedTabs();list.remember({private:true,url:'https://secret.test'},0);
  list.remember({private:false,url:'file:///local'},0);assert.equal(list.take(),undefined);
  for(let i=0;i<20;i++)list.remember({private:false,url:`https://example.test/${i}`},i);
  assert.equal(list.items.length,15);assert.deepEqual(list.take(),{url:'https://example.test/19',index:19});list.clear();assert.equal(list.items.length,0);
});
