const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {review}=require('../tools/release-gate.cjs');
test('public release gate rejects incomplete candidate and unsupported approval claims',()=>{
 const r=JSON.parse(fs.readFileSync(path.join(__dirname,'../release/readiness.json')));
 const i=JSON.parse(fs.readFileSync(path.join(__dirname,'../compliance/dependencies.json')));
 assert(review(r,i).length>=8);r.publicReleaseAllowed=true;
 for(const key of Object.keys(r.checks))r.checks[key]=true;
 const errors=review(r,i);assert(errors.some(e=>e.includes('no retained review evidence')));assert(errors.some(e=>e.includes('unresolved findings')));
 r.evidence.brandingCleared='release/evidence/../../LICENSE';assert(review(r,i).some(e=>e.includes('brandingCleared has no retained')));
 r.signingAuthorized=false;assert(review(r,i,'pre-sign').some(e=>e.includes('not authorized signing')));
});
