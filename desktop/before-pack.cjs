// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs/promises'),path=require('node:path');
const crypto=require('node:crypto');
const {loadFilters}=require('./filter-cache.cjs');
module.exports=async()=>{
 const shared=path.resolve(__dirname,'../shared');
 const names=['easylist.txt','easyprivacy.txt','starter.txt','ublock/filters.txt','ublock/quick-fixes.txt','ublock/unbreak.txt'];
 const filters=(await Promise.all(names.map(name=>fs.readFile(path.join(shared,name),'utf8')))).join('\n');
 const resources=await fs.readFile(path.join(shared,'ublock/resources.json'),'utf8');
 const provenance=JSON.parse(await fs.readFile(path.join(shared,'filter-provenance.json'),'utf8'));
 if(crypto.createHash('sha256').update(resources).digest('hex')!==provenance.files['resources.json'].sha256)throw Error('Bundled scriptlet resource integrity failed');
 const result=await loadFilters({filters,resources,directory:path.join(shared,'compiled')});
 console.log('Prepared compiled filter cache: '+result.source+' / '+Math.round(result.elapsedMs)+' ms');
};
