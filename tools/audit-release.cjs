// SPDX-License-Identifier: GPL-3.0-or-later
// Read-only inventory of installed runtime dependencies and retained notices.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'), desktop=path.join(root,'desktop');
const pkg=JSON.parse(fs.readFileSync(path.join(desktop,'package.json')));
const lock=JSON.parse(fs.readFileSync(path.join(desktop,'package-lock.json')));
const sourceFile=path.join(root,'compliance/npm-source-records.json');
const sources=fs.existsSync(sourceFile)?JSON.parse(fs.readFileSync(sourceFile)):[];
const seen=new Map();
function visit(name,from=desktop){
 const file=require.resolve(name+'/package.json',{paths:[from]});const dir=path.dirname(file);if(seen.has(dir))return;
 const p=JSON.parse(fs.readFileSync(file));const relative=path.relative(desktop,dir).replaceAll('\\','/');
 const notices=fs.readdirSync(dir).filter(f=>/^(license|licence|copying|notice)(\.|$|-)/i.test(f));
 const source=sources.find(s=>s.name===p.name&&s.version===p.version);
 seen.set(dir,{name:p.name,version:p.version,license:p.license||'NOASSERTION',installedPath:relative,
  integrity:lock.packages[relative]?.integrity||null,noticeFiles:notices,
  noticeHashes:notices.map(f=>({file:f,sha256:hash(fs.readFileSync(path.join(dir,f)))})),
  sourceStatus:source?.sourceStatus||'unresolved',sourceArchive:source?.archive||null,
  sourceSha256:source?.sha256||null,gitHead:source?.gitHead||null,repository:source?.repository||p.repository||null});
 for(const dep of Object.keys(p.dependencies||{}))visit(dep,dir);
}
function hash(b){return crypto.createHash('sha256').update(b).digest('hex');}
for(const name of Object.keys(pkg.dependencies))visit(name);
const dependencies=[...seen.values()].sort((a,b)=>a.name.localeCompare(b.name));
const files=['LICENSE','LICENSE-SCOPE.md','PRIVACY.txt','SOURCE-ACCESS.txt','desktop/assets/aegis.svg',
 'shared/easylist.txt','shared/easyprivacy.txt','shared/domains.txt','shared/ublock/filters.txt','shared/ublock/quick-fixes.txt','shared/ublock/unbreak.txt','shared/ublock/resources.json','shared/filter-provenance.json'];
const inputs=files.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
const inventory={format:'sukoaa-release-audit-v1',version:pkg.version,licenseDecision:'GPL-3.0-or-later',
 publicReleaseAllowed:false,dependencies,inputs,
 runtimes:[{name:'Electron',version:pkg.devDependencies.electron,license:'MIT plus bundled third-party licenses',source:'https://github.com/electron/electron/tree/v'+pkg.devDependencies.electron,sourceStatus:'exact-tag-locator; full Chromium/FFmpeg corresponding-source obligations remain under review'},
 {name:'GeckoView',version:'159.0.20261022150525',license:'MPL-2.0 plus bundled third-party licenses',source:'https://hg.mozilla.org/releases/mozilla-release/rev/5add844c26613d7e4d84c799d6e23cf987b1240d',sourceStatus:'exact upstream revision locator; resolved runtime graph exported; per-component license/source review pending'},
 {name:'Android System WebView',version:'device supplied',license:'device/runtime dependent',sourceStatus:'not redistributed in APK'}],
 unresolved:['uBlock scriptlet preferred-form upstream revision/build mapping','Electron/Chromium bundled copyleft source and component obligations','Android runtime component license/source coverage (resolved graph exported)','trademark/name clearance','public publisher/contact and source URL','trusted Windows publisher signing','physical Windows/Linux/Android evidence','public security-update channel']};
fs.mkdirSync(path.join(root,'compliance'),{recursive:true});
fs.writeFileSync(path.join(root,'compliance/dependencies.json'),JSON.stringify(inventory,null,2)+'\n');
const packages=dependencies.map((d,i)=>({name:d.name,SPDXID:'SPDXRef-npm-'+i,versionInfo:d.version,
 downloadLocation:d.repository&&typeof d.repository==='string'?d.repository:'NOASSERTION',filesAnalyzed:false,
 licenseConcluded:'NOASSERTION',licenseDeclared:typeof d.license==='string'?d.license:'NOASSERTION',copyrightText:'NOASSERTION',
 externalRefs:[{referenceCategory:'PACKAGE-MANAGER',referenceType:'purl',referenceLocator:'pkg:npm/'+(d.name.startsWith('@')?'%40'+d.name.slice(1):d.name)+'@'+d.version}]}));
fs.writeFileSync(path.join(root,'compliance/sbom.spdx.json'),JSON.stringify({spdxVersion:'SPDX-2.3',dataLicense:'CC0-1.0',SPDXID:'SPDXRef-DOCUMENT',name:'Sukoaa candidate '+pkg.version,
 documentNamespace:'https://aegis.invalid/spdx/'+crypto.randomUUID(),creationInfo:{created:new Date().toISOString(),creators:['Tool: tools/audit-release.cjs']},documentComment:'Runtime npm inventory only. Electron/Chromium and Android engine graphs are separately tracked; this is not a complete all-platform SBOM or legal conclusion.',packages},null,2)+'\n');
console.log(JSON.stringify({runtimeNpmPackages:dependencies.length,exactSourceSnapshots:dependencies.filter(d=>d.sourceStatus==='exact-version-gitHead-source-captured').length,missingPackageNoticeFiles:dependencies.filter(d=>!d.noticeFiles.length).map(d=>d.name),unresolved:inventory.unresolved.length}));
