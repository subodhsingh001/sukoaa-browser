// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {FiltersEngine}=require('@ghostery/adblocker');
const version=require('@ghostery/adblocker/package.json').version;
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function compileOffThread(filters,resources){return new Promise((resolve,reject)=>{
 const worker=new Worker(path.join(__dirname,'filter-worker.cjs'),{workerData:{filters,resources}});
 let received=false;
 const timer=setTimeout(()=>{worker.terminate();reject(Error('Filter compilation timed out'));},60000);
 worker.once('message',result=>{received=true;clearTimeout(timer);if(result.error)reject(Error(result.error));else resolve(result.bytes);});
 worker.once('error',error=>{clearTimeout(timer);reject(error);});
 worker.once('exit',code=>{clearTimeout(timer);if(!received)reject(Error('Filter worker exited before returning a result: '+code));});
});}
async function readCache(directory,key,resources,trusted=false){
 const file=path.join(directory,'filters-compiled-v1.bin'),metadata=file+'.json';
 const [stat,meta]=await Promise.all([fs.lstat(file),fs.lstat(metadata)]);
 if(!stat.isFile()||stat.size<1||stat.size>67108864||!meta.isFile()||meta.size>4096)throw Error('Cache size rejected');
 const saved=JSON.parse(await fs.readFile(metadata,'utf8'));if(saved.key!==key)throw Error('Cache inputs changed');
 const bytes=new Uint8Array(await fs.readFile(file));if(hash(bytes)!==saved.sha256)throw Error('Cache checksum rejected');
 const engine=FiltersEngine.deserialize(bytes);
 if(!trusted){engine.resources.checksum='';engine.updateResources(resources,hash(resources));}
 return engine;
}
async function loadFilters({filters,resources,directory,bundledDirectory}){
 const start=performance.now(),key=hash('sukoaa-cache-v1\0'+version+'\0'+filters+'\0'+resources);
 const file=path.join(directory,'filters-compiled-v1.bin'),metadata=file+'.json';let bytes;
 try {
  const engine=await readCache(directory,key,resources);
  return {engine,cacheHit:true,source:'profile',elapsedMs:performance.now()-start};
 }catch{}
 if(bundledDirectory)try{
   const engine=await readCache(bundledDirectory,key,resources,true);
   return {engine,cacheHit:true,source:'bundled',elapsedMs:performance.now()-start};
 }catch{}
 bytes=await compileOffThread(filters,resources);const engine=FiltersEngine.deserialize(bytes);
 engine.resources.checksum='';engine.updateResources(resources,hash(resources));
 try {
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  const suffix='.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(file+suffix,bytes,{mode:0o600});await fs.rename(file+suffix,file);
  await fs.writeFile(metadata+suffix,JSON.stringify({key,sha256:hash(bytes),version}),{mode:0o600});await fs.rename(metadata+suffix,metadata);
 }catch{} // A read-only/full profile may still browse with the validated engine.
 return {engine,cacheHit:false,source:'worker',elapsedMs:performance.now()-start};
}
module.exports={loadFilters,compileOffThread};
