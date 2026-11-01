// Local initialization benchmark, not a website or competing-browser benchmark.
const fs=require('node:fs/promises'),path=require('node:path');
const {compile}=require('../desktop/filter-compiler.cjs');
const {loadFilters}=require('../desktop/filter-cache.cjs');
(async()=>{
 const shared=path.resolve(__dirname,'../shared'),names=['easylist.txt','easyprivacy.txt','starter.txt','ublock/filters.txt','ublock/quick-fixes.txt','ublock/unbreak.txt'];
 const filters=(await Promise.all(names.map(n=>fs.readFile(path.join(shared,n),'utf8')))).join('\n'),resources=await fs.readFile(path.join(shared,'ublock/resources.json'),'utf8');
 const samples=[];
 for(let i=0;i<7;i++){
  const start=performance.now();compile(filters,resources);const parseMs=performance.now()-start;
  const cached=await loadFilters({filters,resources,directory:path.join(shared,'compiled')});samples.push({parseMs,cachedMs:cached.elapsedMs});
 }
 const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[3];
 console.log(JSON.stringify({scope:'Same-process filter initialization only; seven runs; warm file-system cache; no website/Chrome comparison',node:process.version,filterBytes:Buffer.byteLength(filters),samples,medianParseMs:median('parseMs'),medianCachedMs:median('cachedMs')},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
