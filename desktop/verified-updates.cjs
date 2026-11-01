// SPDX-License-Identifier: GPL-3.0-or-later
const crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {execFile}=require('node:child_process');
function compareVersion(a,b){
 const parse=value=>{if(!/^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/.test(value))throw Error('Invalid release version');return value.split('.').map(Number);};
 const x=parse(a),y=parse(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;
}
function allowedURL(raw,config){
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||!config.allowedOrigins.includes(url.origin))throw Error('Update URL is not an approved HTTPS origin');
 return url.href;
}
function validateConfig(config,platform){
 if(config.enabled!==true)throw Error('Verified updates are not configured for this build');
 if(!Array.isArray(config.allowedOrigins)||!config.allowedOrigins.length)throw Error('No trusted release origins');
 for(const origin of config.allowedOrigins){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw Error('Invalid release origin');}
 allowedURL(config.manifestURL,config);
 const key=crypto.createPublicKey(config.publicKey);if(key.asymmetricKeyType!=='ed25519')throw Error('An Ed25519 release public key is required');
 if(platform==='win32'&&!/^[a-f\d]{40}$/i.test(config.windowsPublisherThumbprint || ''))throw Error('A trusted Windows publisher fingerprint is required');
 return key;
}
function verifyManifest(envelope,config,{currentVersion,minimumVersion=currentVersion,platform,arch,now=Date.now()}){
 const key=validateConfig(config,platform);
 if(typeof envelope.payload!=='string'||envelope.payload.length>180000||typeof envelope.signature!=='string'||envelope.signature.length>256)throw Error('Invalid update envelope');
 const payload=Buffer.from(envelope.payload,'base64');
 if(!crypto.verify(null,payload,key,Buffer.from(envelope.signature,'base64')))throw Error('Update manifest signature rejected');
 const manifest=JSON.parse(payload.toString('utf8'));
 const released=Date.parse(manifest.releasedAt),expires=Date.parse(manifest.expiresAt);
 if(manifest.schema!==1||!Number.isFinite(released)||!Number.isFinite(expires)||released>now+300000||expires<=now||expires<=released||expires-released>1209600000)throw Error('Update manifest is expired or has invalid dates');
 compareVersion(manifest.version,currentVersion);
 if(compareVersion(manifest.version,minimumVersion)<0)throw Error('Release rollback rejected');
 if(!Array.isArray(manifest.artifacts)||manifest.artifacts.length>20||typeof manifest.notes!=='string'||manifest.notes.length>8000)throw Error('Invalid release metadata');
 const artifact=manifest.artifacts.find(a=>a.platform===platform&&a.arch===arch);
 if(!artifact)throw Error('No release for this operating system');
 allowedURL(artifact.url,config);
 if(!Number.isSafeInteger(artifact.size)||artifact.size<1||artifact.size>1073741824||!/^[a-f\d]{64}$/i.test(artifact.sha256))throw Error('Invalid artifact digest or size');
 if(platform==='win32'&&!new URL(artifact.url).pathname.toLowerCase().endsWith('.exe'))throw Error('Windows update must be an installer');
 return {version:manifest.version,expiresAt:expires,notes:manifest.notes,artifact,available:compareVersion(manifest.version,currentVersion)>0};
}
async function boundedJSON(response,limit=262144){
 if(!response.ok||Number(response.headers.get('content-length'))>limit)throw Error('Update manifest download rejected');
 const reader=response.body.getReader();const chunks=[];let size=0;
 for(;;){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>limit){await reader.cancel();throw Error('Update manifest is too large');}chunks.push(Buffer.from(result.value));}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function verifyWindowsPublisher(file,thumbprint){
 const script="$s=Get-AuthenticodeSignature -LiteralPath $env:SUKOAA_UPDATE_FILE; @{status=$s.Status.ToString();thumbprint=$s.SignerCertificate.Thumbprint;timestamp=[bool]$s.TimeStamperCertificate}|ConvertTo-Json -Compress";
 const result=await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,SUKOAA_UPDATE_FILE:file},windowsHide:true,timeout:30000,maxBuffer:65536},(error,stdout)=>error?reject(error):resolve(stdout)));
 const data=JSON.parse(result);if(data.status!=='Valid'||String(data.thumbprint).toUpperCase()!==thumbprint.toUpperCase()||!data.timestamp)throw Error('Windows publisher signature or timestamp rejected');
}
class VerifiedUpdates {
 constructor(config,options){this.config=config;this.options=options;this.fetch=options.fetch || fetch;this.verifyPublisher=options.verifyPublisher || verifyWindowsPublisher;this.candidate=null;
  this.state={configured:config.enabled===true,status:config.enabled===true?'ready':'disabled',version:options.currentVersion,error:'',notes:'',available:false,downloadedBytes:0};this.busy=false;
 }
 async check(){
  if(this.busy)throw Error('An update operation is already running');this.busy=true;this.state.error='';this.candidate=null;this.state.available=false;
  try{
   validateConfig(this.config,this.options.platform);this.state.status='checking';
   const response=await this.fetch(allowedURL(this.config.manifestURL,this.config),{redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
   const candidate=verifyManifest(await boundedJSON(response),this.config,this.options);
   this.candidate=candidate;this.state={...this.state,status:candidate.available?'available':'current',available:candidate.available,version:candidate.version,notes:candidate.notes,checkedAt:Date.now()};
   if(compareVersion(candidate.version,this.options.minimumVersion || this.options.currentVersion)>0){this.options.minimumVersion=candidate.version;this.options.onSeenVersion?.(candidate.version);}
   return this.state;
  }catch(error){this.state.status='error';this.state.error=error.message;throw error;}finally{this.busy=false;}
 }
 async download(destination,onProgress=()=>{}){
  if(this.busy||!this.candidate?.available)throw Error('Check for a verified update first');
  if(this.candidate.expiresAt<=Date.now())throw Error('Check for updates again; the manifest expired');
  this.busy=true;const artifact=this.candidate.artifact,temp=destination+'.'+crypto.randomUUID()+'.part';let handle;
  try{
   this.state.status='downloading';this.state.error='';this.state.downloadedBytes=0;
   const response=await this.fetch(allowedURL(artifact.url,this.config),{redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(300000)});
   if(!response.ok||(response.headers.has('content-length')&&Number(response.headers.get('content-length'))!==artifact.size))throw Error('Artifact size rejected');
   handle=await fs.open(temp,'wx',0o600);const hash=crypto.createHash('sha256'),reader=response.body.getReader();let size=0;
   for(;;){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>artifact.size){await reader.cancel();throw Error('Artifact exceeds its signed size');}hash.update(result.value);await handle.writeFile(result.value);this.state.downloadedBytes=size;onProgress();}
   await handle.close();handle=null;
   if(size!==artifact.size||hash.digest('hex')!==artifact.sha256.toLowerCase())throw Error('Artifact checksum rejected');
   if(this.options.platform==='win32')await this.verifyPublisher(temp,this.config.windowsPublisherThumbprint);
   await fs.rename(temp,destination);this.state.status='downloaded';this.state.savedFile=path.basename(destination);return this.state;
  }catch(error){this.state.status='error';this.state.error=error.message;throw error;}
  finally{if(handle)await handle.close().catch(()=>{});await fs.unlink(temp).catch(()=>{});this.busy=false;}
 }
}
module.exports={VerifiedUpdates,verifyManifest,validateConfig,compareVersion,verifyWindowsPublisher};
