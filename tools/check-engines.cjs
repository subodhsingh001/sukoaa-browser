// SPDX-License-Identifier: GPL-3.0-or-later
// CI check only: reports upstream updates; never edits or publishes dependencies.
const fs=require('node:fs'),path=require('node:path');
async function text(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Upstream check failed: '+r.status);return r.text();}
(async()=>{
 const pkg=require('../desktop/package.json'),gradle=fs.readFileSync(path.join(__dirname,'../android/app/build.gradle'),'utf8');
 const [releases,metadata]=await Promise.all([text('https://releases.electronjs.org/releases.json'),text('https://maven.mozilla.org/maven2/org/mozilla/geckoview/geckoview/maven-metadata.xml')]);
 const stable=JSON.parse(releases).filter(r=>/^\d+\.\d+\.\d+$/.test(r.version)).sort((a,b)=>require('../desktop/verified-updates.cjs').compareVersion(b.version,a.version))[0];
 const gecko=metadata.match(/<release>([^<]+)<\/release>/)?.[1],installed=gradle.match(/geckoview:([\d.]+)/)?.[1];
 if(!stable?.version||!gecko||!installed)throw Error('Upstream response could not be validated');
 const report={checkedAt:new Date().toISOString(),electron:{installed:pkg.devDependencies.electron,upstream:stable.version},geckoview:{installed,upstream:gecko}};
 console.log(JSON.stringify(report,null,2));
 if(stable.version!==pkg.devDependencies.electron||gecko!==installed)throw Error('Engine update available: review security advisories, upgrade, rebuild and rerun native/device tests.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
