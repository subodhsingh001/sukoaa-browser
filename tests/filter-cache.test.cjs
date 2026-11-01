const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {loadFilters}=require('../desktop/filter-cache.cjs');
const {Request}=require('../desktop/node_modules/@ghostery/adblocker');
test('filter cache survives restart and rebuilds after corruption or input changes',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sukoaa-cache-'));const resources=await fs.readFile(path.join(__dirname,'../shared/ublock/resources.json'),'utf8');
 const filters='||ads.example^';let ticks=0;const timer=setInterval(()=>ticks++,1);
 try{
  let result=await loadFilters({filters,resources,directory});assert.equal(result.source,'worker');assert(ticks>0,'worker compilation yields main process');
  const match=engine=>engine.match(Request.fromRawDetails({url:'https://ads.example/banner.js',sourceUrl:'https://page.example/',type:'script'})).match;
  assert(match(result.engine));result=await loadFilters({filters,resources,directory});assert.equal(result.source,'profile');assert(match(result.engine));
  const file=path.join(directory,'filters-compiled-v1.bin');await fs.writeFile(file,'corrupt');result=await loadFilters({filters,resources,directory});assert.equal(result.source,'worker');assert(match(result.engine));
  result=await loadFilters({filters:'||different.example^',resources,directory});assert.equal(result.source,'worker');assert.equal(match(result.engine),false);
  await fs.writeFile(file+'.json','x'.repeat(4097));result=await loadFilters({filters,resources,directory});assert.equal(result.source,'worker');
 }finally{clearInterval(timer);await fs.rm(directory,{recursive:true,force:true});}
});
