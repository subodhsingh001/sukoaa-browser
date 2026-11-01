const test=require('node:test'),assert=require('node:assert/strict');
const {SitePermissions,origin,requested}=require('../desktop/site-permissions.cjs');
function fixture(priv=false) {
 const saved={},ses={},wc={session:ses,getURL:()=>url,isDestroyed:()=>false};let url='https://example.test/path',resolve;
 const tab={private:priv,view:{webContents:wc}};let current=tab,saves=0,response=1;
 const p=new SitePermissions({saved:()=>saved,save:()=>saves++,find:w=>w===wc?tab:null,active:()=>current,prompt:async()=>({response}),changed:()=>{}});
 return {p,tab,wc,saved,saves:()=>saves,response:v=>response=v,navigate:v=>url=v,background:()=>current=null};
}
function req(f,permission='media',details={isMainFrame:true,requestingUrl:'https://example.test/path',mediaTypes:['video','audio']}){return new Promise(r=>f.p.request(f.wc,permission,r,details));}
test('secure origin canonicalization and supported permission boundaries',()=>{
 assert.equal(origin('https://EXAMPLE.test:443/a'),'https://example.test');assert.equal(origin('http://example.test'),'');assert.equal(origin('http://localhost:8080'),'http://localhost:8080');
 assert.deepEqual(requested('media',{mediaTypes:['audio','video']}),['microphone','camera']);assert.deepEqual(requested('display-capture'),[]);assert.deepEqual(requested('media',{}),[]);
});
test('normal persistent grants, blocks, combined requests, reset and permission checks',async()=>{
 const f=fixture();assert.equal(await req(f),true);assert.equal(f.saves(),1);
 assert.equal(f.p.check(f.wc,'media','https://example.test',{mediaType:'video',isMainFrame:true}),true);
 assert.equal(f.p.check(f.wc,'media','https://evil.test',{mediaType:'video',isMainFrame:true}),false);
 f.p.set(f.tab,'https://example.test','microphone','block');assert.equal(await req(f),false);
 f.p.reset(f.tab);assert.deepEqual(f.saved,{});assert.equal(f.p.get(f.tab,'https://example.test','camera'),'ask');
});
test('session and private grants never write saved site history',async()=>{
 for(const priv of [false,true]){const f=fixture(priv);f.response(0);assert.equal(await req(f),true);assert.deepEqual(f.saved,{});assert.equal(f.saves(),0);assert.equal(f.p.get(f.tab,'https://example.test','camera'),'allow');}
 const f=fixture(true);f.response(1);assert.equal(await req(f),false);assert.deepEqual(f.saved,{});
});
test('insecure, embedded, background and unsupported requests deny without a prompt',async()=>{
 const f=fixture();f.p.prompt=()=>{throw Error('must not prompt')};
 assert.equal(await req(f,'notifications'),false);assert.equal(await req(f,'media',{isMainFrame:false,requestingUrl:'https://example.test',mediaTypes:['video']}),false);
 f.navigate('http://example.test');assert.equal(await req(f),false);f.navigate('https://example.test/path');f.background();assert.equal(await req(f),false);
});
test('navigation, tab close, settings changes and duplicate requests invalidate pending approval',async()=>{
 for(const change of ['navigate','close','reset','reload']) {
  const f=fixture();let resolve;f.p.prompt=()=>new Promise(r=>resolve=r);
  const pending=req(f);assert.equal(await req(f),false);
  if(change==='reload')f.tab.permissionRevision=1;
  if(change==='navigate')f.navigate('https://example.test/new');if(change==='close')f.tab.closed=true;if(change==='reset')f.p.reset(f.tab);
  resolve({response:1});assert.equal(await pending,false);assert.deepEqual(f.saved,{});
 }
});
