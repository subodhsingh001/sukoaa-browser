// SPDX-License-Identifier: GPL-3.0-or-later
// Verify retained bytes and inventory consistency. This is not a legal opinion.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function checkedFile(root,relative,expected){
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('\\')||relative.split('/').some(x=>!x||x==='..'||x==='.')||typeof expected!=='string'||!/^([a-f0-9]{64})$/.test(expected))return {status:'invalid-record'};
 const full=path.join(root,relative);
 try{const stat=fs.lstatSync(full);if(!stat.isFile()||stat.isSymbolicLink()||!fs.realpathSync(full).startsWith(fs.realpathSync(root)+path.sep))return {status:'unsafe-file'};const actual=hash(fs.readFileSync(full));return {status:actual===expected?'verified':'hash-mismatch',sha256:actual,bytes:stat.size}}catch(e){return {status:'missing',error:e.code||'unreadable'}}
}
function inspect(root){
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const pkg=read('desktop/package.json'),lock=read('desktop/package-lock.json'),records=read('compliance/npm-source-records.json');
 const errors=[],archives=new Map(),packages=[];
 for(const record of records){
  const archive='compliance/sources/'+record.archive;
  let check=archives.get(archive);
  if(!check){check=checkedFile(root,archive,record.sha256);if(check.status==='verified')try{const data=zlib.gunzipSync(fs.readFileSync(path.join(root,archive)),{maxOutputLength:250_000_000});if(data.length<1024||!data.subarray(257,263).toString().startsWith('ustar'))check={...check,status:'invalid-tar'};}catch{check={...check,status:'invalid-gzip'}}archives.set(archive,check)}
  const matches=Object.values(lock.packages).filter(p=>p.name===record.name||p.resolved===record.tarball);
  // npm lock entries may omit name; resolve the package location explicitly too.
  for(const [location,entry] of Object.entries(lock.packages))if(location.endsWith('node_modules/'+record.name)&&!matches.includes(entry))matches.push(entry);
  const locked=matches.some(p=>p.version===record.version&&p.integrity===record.integrity);
  packages.push({name:record.name,version:record.version,declaredLicense:record.license,archive,sourceBytes:check.status,lockVersionAndIntegrity:locked?'matched':'mismatch',legalReview:'not concluded'});
  if(check.status!=='verified'||!locked)errors.push(record.name+': source/lock validation incomplete');
 }
 // Require one captured source record for every package in the runtime dependency closure.
 const seen=new Set();function visit(name,from=''){
  let base=from,location;
  while(true){const candidate=(base?base+'/':'')+'node_modules/'+name;if(lock.packages[candidate]){location=candidate;break}if(!base)break;base=base.includes('/')?base.slice(0,base.lastIndexOf('/')):''}
  if(!location){errors.push('Runtime dependency missing from lock: '+name);return}if(seen.has(location))return;seen.add(location);const dep=lock.packages[location];
  if(!records.some(r=>r.name===name&&r.version===dep.version&&r.integrity===dep.integrity))errors.push('No exact source record for runtime package '+name+'@'+dep.version);
  for(const child of Object.keys(dep.dependencies||{}))visit(child,location);
 }
 for(const dep of Object.keys(pkg.dependencies||{}))visit(dep);
 const provenance=read('shared/filter-provenance.json');const filterFiles=Object.entries(provenance.files).map(([name,value])=>({file:'shared/ublock/'+name,...checkedFile(root,'shared/ublock/'+name,value.sha256)}));
 if(filterFiles.some(row=>row.status!=='verified'))errors.push('Retained filter/scriptlet bytes differ from their provenance record');
 const required=['LICENSE','LICENSE-SCOPE.md','SOURCE-ACCESS.txt','THIRD-PARTY-NOTICES.md','shared/ublock/LICENSE-GPL-3.0.txt','shared/LICENSE-CC-BY-SA.txt','android/app/src/main/assets/LICENSE-MPL-2.0.txt'];
 const notices=required.map(file=>{try{const s=fs.lstatSync(path.join(root,file));return {file,present:s.isFile()&&s.size>0&&!s.isSymbolicLink()}}catch{return {file,present:false}}});if(notices.some(row=>!row.present))errors.push('Required retained license/notice file missing');
 const androidFile=path.join(root,'compliance/android-license-metadata.json');const android=fs.existsSync(androidFile)?read('compliance/android-license-metadata.json'):undefined;
 const androidMetadata=android?(android.results||[]).map(row=>({coordinate:row.coordinate,declaredLicenses:row.declaredLicenses||[],...(row.pom?checkedFile(root,row.pom,row.sha256):{status:'missing'}),legalReview:'not concluded'})):[];
 const expectedAndroid=new Set(read('compliance/android-runtime.json').artifacts.map(row=>[row.group,row.name,row.version].join(':')));const capturedAndroid=new Set(androidMetadata.map(row=>row.coordinate));if(!android||androidMetadata.some(row=>row.status!=='verified')||androidMetadata.length!==capturedAndroid.size||[...expectedAndroid].some(key=>!capturedAndroid.has(key)))errors.push('Android license metadata collection incomplete');
 const sdkTermsReview=androidMetadata.filter(row=>row.declaredLicenses.some(l=>/Android Software Development Kit/i.test(l.name)));
 const requiredReview=[{id:'scriptlet-preferred-source',reason:'The pinned minified scriptlet mirror is verified, but its preferred-source revision and exact conversion/build mapping still require completion.'},{id:'engine-source-and-notices',reason:'Electron/Chromium and GeckoView have bundled component obligations; runtime inventories alone do not supply complete corresponding source or release-specific binary notices.'},{id:'android-source-and-terms',reason:'POM license declarations are metadata, not source delivery or a compatibility conclusion. Review Android SDK-licensed Google Play services and all resolved components.'},{id:'publisher-and-brand',reason:'Confirm name/logo clearance, real publisher/support/privacy contacts and a public versioned source URL.'}];
 return {format:'sukoaa-compliance-check-v1',releaseVersion:pkg.version,applicationLicense:pkg.license,scope:'source-package integrity and inventory consistency; no runtime or legal certification',runtimeDependencyLocations:seen.size,sourceArchiveCount:archives.size,sourceArchives:[...archives].map(([file,value])=>({file,...value})),packages,filterFiles,notices,androidMetadata,sdkTermsReview:sdkTermsReview.map(row=>row.coordinate),integrityErrors:[...new Set(errors)],requiredReview,publicReleaseAllowed:false};
}
if(require.main===module){try{const root=path.resolve(__dirname,'..'),report=inspect(root);if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'compliance/current-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({releaseVersion:report.releaseVersion,verifiedSourceArchives:report.sourceArchives.filter(r=>r.status==='verified').length,sourceArchiveCount:report.sourceArchiveCount,runtimeDependencyLocations:report.runtimeDependencyLocations,sourcePackageRecords:report.packages.length,androidMetadataRecords:report.androidMetadata.length,androidSdkTermsReview:report.sdkTermsReview,integrityErrors:report.integrityErrors,requiredLegalAndSourceReviews:report.requiredReview.map(r=>r.id),publicReleaseAllowed:false},null,2));if(report.integrityErrors.length||(process.argv.includes('--strict')&&report.requiredReview.length))process.exitCode=1}catch(e){console.error('Compliance check failed:',e.message);process.exitCode=1}}
module.exports={inspect,checkedFile};
