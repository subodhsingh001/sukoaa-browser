const test=require('node:test'),assert=require('node:assert/strict');
const {fetchFilterText}=require('../desktop/filter-download.cjs');
test('filter downloads bound streamed bytes and reject unapproved hosts/redirects',async()=>{
 const url='https://easylist.to/easylist/easylist.txt';
 assert.equal((await fetchFilterText(url,async(u,options)=>{assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return new Response('a'.repeat(1000));})).length,1000);
 await assert.rejects(fetchFilterText('http://easylist.to/list'),/Unapproved/);
 await assert.rejects(fetchFilterText('https://attacker.example/list'),/Unapproved/);
 await assert.rejects(fetchFilterText(url,async()=>new Response('short')),/Invalid/);
 await assert.rejects(fetchFilterText(url,async()=>new Response('',{status:302})),/rejected/);
 await assert.rejects(fetchFilterText(url,async()=>new Response('x'.repeat(20000001))),/size limit/);
});
