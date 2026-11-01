const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {VerifiedUpdates,verifyManifest,validateConfig,compareVersion}=require('../desktop/verified-updates.cjs');
const keys=crypto.generateKeyPairSync('ed25519');
const config={enabled:true,manifestURL:'https://releases.example/manifest.json',allowedOrigins:['https://releases.example'],publicKey:keys.publicKey.export({type:'spki',format:'pem'}),windowsPublisherThumbprint:'a'.repeat(40)};
const options={currentVersion:'0.9.0',platform:'win32',arch:'x64'};
const bytes=Buffer.from('test installer bytes');
function manifest(){return {schema:1,version:'0.9.1',releasedAt:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),notes:'Test release',artifacts:[{platform:'win32',arch:'x64',url:'https://releases.example/setup.exe',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]};}
function sign(m){const payload=Buffer.from(JSON.stringify(m));return {payload:payload.toString('base64'),signature:crypto.sign(null,payload,keys.privateKey).toString('base64')};}
test('signed metadata rejects tampering, expiry, rollback, bad keys, hosts and platform',()=>{
 const m=manifest();assert.equal(verifyManifest(sign(m),config,options).available,true);
 const tampered=sign(m);tampered.payload=Buffer.from(JSON.stringify({...m,version:'9.0.0'})).toString('base64');assert.throws(()=>verifyManifest(tampered,config,options),/signature/);
 for(const changes of [{expiresAt:new Date(Date.now()-1000).toISOString()},{version:'0.8.9'},{version:'garbage'},{schema:2},{artifacts:[{...m.artifacts[0],url:'https://attacker.example/setup.exe'}]},{artifacts:[{...m.artifacts[0],size:1073741825}]},{artifacts:[{...m.artifacts[0],platform:'linux'}]}])assert.throws(()=>verifyManifest(sign({...m,...changes}),config,options));
 assert.throws(()=>verifyManifest(sign(m),config,{...options,minimumVersion:'0.9.2'}),/rollback/);
 assert.throws(()=>validateConfig({...config,enabled:false},'win32'),/not configured/);
 assert.throws(()=>validateConfig({...config,windowsPublisherThumbprint:null},'win32'),/publisher/);
 assert.equal(compareVersion('0.10.0','0.9.9'),1);
});
test('downloads require signed size/digest and Windows publisher, never save failed bytes',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sukoaa-updates-'));const destination=path.join(directory,'setup.exe');let publisherCalls=0,download=bytes;
 const client=new VerifiedUpdates(config,{...options,fetch:async(url,init)=>{assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');return url.endsWith('.json')?new Response(JSON.stringify(sign(manifest()))):new Response(download);},verifyPublisher:async()=>{publisherCalls++;}});
 try{
  await client.check();await client.download(destination);assert.deepEqual(await fs.readFile(destination),bytes);assert.equal(publisherCalls,1);await fs.unlink(destination);
  download=Buffer.from('wrong content');await assert.rejects(client.download(destination),/checksum/);assert.deepEqual(await fs.readdir(directory),[]);assert.equal(publisherCalls,1);
  download=Buffer.concat([bytes,bytes]);await assert.rejects(client.download(destination),/size/);assert.deepEqual(await fs.readdir(directory),[]);
  download=bytes;client.verifyPublisher=async()=>{throw Error('Publisher rejected');};await assert.rejects(client.download(destination),/Publisher rejected/);assert.deepEqual(await fs.readdir(directory),[]);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('disabled channel performs no network requests; oversized metadata is rejected',async()=>{
 let requests=0;const client=new VerifiedUpdates({enabled:false},{...options,fetch:async()=>{requests++;}});await assert.rejects(client.check());assert.equal(requests,0);
 const large=new VerifiedUpdates(config,{...options,fetch:async()=>new Response('x'.repeat(262145))});await assert.rejects(large.check(),/too large/);
});
