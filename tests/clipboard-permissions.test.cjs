const test=require('node:test'),assert=require('node:assert/strict');
const {canWriteClipboard}=require('../desktop/clipboard-permissions.cjs');
const wc=(url='https://chatgpt.com/c/test',focused=true)=>({getURL:()=>url,isDestroyed:()=>false,isFocused:()=>focused});
test('focused secure top-level website may copy without a saved grant',()=>{
  assert.equal(canWriteClipboard(wc(),'https://chatgpt.com',{},true),true);
  assert.equal(canWriteClipboard(wc('http://localhost:8080/'),'http://localhost:8080/',{isMainFrame:true},true),true);
});
test('background, unfocused, closed, insecure and embedded clipboard writes are rejected',()=>{
  for(const [page,url,details,foreground] of [
    [wc(),'https://chatgpt.com',{},false],
    [wc(undefined,false),'https://chatgpt.com',{},true],
    [null,'https://chatgpt.com',{},true],
    [{isDestroyed:()=>true},'https://chatgpt.com',{},true],
    [wc('http://example.com/'),'http://example.com',{},true],
    [wc(),'https://evil.example',{},true],
    [wc(),'https://chatgpt.com',{isMainFrame:false},true],
    [wc(),'https://chatgpt.com',{requestingUrl:'https://evil.example'},true],
    [wc(),'file:///tmp/test',{},true]
  ]) assert.equal(canWriteClipboard(page,url,details,foreground),false);
});
