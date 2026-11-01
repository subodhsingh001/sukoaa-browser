const test=require('node:test'),assert=require('node:assert/strict');
const {pageLabel,faviconURL,ClosedTabs}=require('../desktop/tab-tools.cjs');
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
