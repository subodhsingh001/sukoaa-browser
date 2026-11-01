// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function validEvidence(file,version,check){
 try{
  const full=path.join(root,file),stat=fs.lstatSync(full);
  if(!stat.isFile()||stat.size<2||stat.size>1048576||!fs.realpathSync(full).startsWith(path.join(root,'release/evidence')+path.sep))return false;
  const proof=JSON.parse(fs.readFileSync(full,'utf8')),date=Date.parse(proof.reviewedAt);
  return proof.check===check&&proof.releaseVersion===version&&proof.status==='passed'&&typeof proof.reviewer==='string'&&proof.reviewer.trim().length>0&&Number.isFinite(date)&&date<=Date.now()&&typeof proof.details==='string'&&proof.details.trim().length>0;
 }catch{return false;}
}
function review(readiness, inventory, mode="public"){
 const errors=[];const required=['brandingCleared','publicContactConfigured','correspondingSourcesComplete','windowsPublisherSignatureVerified','physicalWindowsTested','physicalLinuxTested','physicalAndroidTested','publicUpdateChannelVerified'];
 for(const name of required.filter(name => mode !== "pre-sign" || name !== "windowsPublisherSignatureVerified")){if(readiness.checks?.[name]!==true)errors.push(name+' is not verified');else{
  const evidence=readiness.evidence?.[name];
  if(typeof evidence!=='string'||!evidence.startsWith('release/evidence/')||evidence.includes('..')||!validEvidence(evidence,readiness.version,name))errors.push(name+' has no retained review evidence');
 }}
 if(inventory.unresolved?.length)errors.push('source/runtime audit has unresolved findings');
 if(inventory.dependencies?.some(d=>d.sourceStatus!=='exact-version-gitHead-source-captured'))errors.push('runtime npm preferred source incomplete');
 if(mode === 'public' && readiness.publicReleaseAllowed!==true)errors.push('release owner has not authorized publication');
 if(mode === 'pre-sign' && readiness.signingAuthorized!==true)errors.push('release owner has not authorized signing');
 return errors;
}
if(require.main===module){const r=JSON.parse(fs.readFileSync(path.join(root,'release/readiness.json')));const i=JSON.parse(fs.readFileSync(path.join(root,'compliance/dependencies.json')));const errors=review(r,i,process.argv.includes("--pre-sign")?"pre-sign":"public");if(errors.length){console.error('PUBLIC RELEASE BLOCKED\n'+errors.map(e=>'- '+e).join('\n'));process.exitCode=1;}else console.log('Release gate passed; verify signatures, artifact/source hashes and store policy separately before upload.');}
module.exports={review};
