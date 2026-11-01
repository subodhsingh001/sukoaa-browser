// SPDX-License-Identifier: GPL-3.0-or-later
// Offline release-owner tool. Never put the private signing key in this project.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {verifyManifest}=require('../desktop/verified-updates.cjs');
function external(file){const resolved=path.resolve(file);if(resolved===root||resolved.startsWith(root+path.sep))throw Error('Private keys must be outside the source tree');return resolved;}
try{
 const [action,input,output]=process.argv.slice(2);
 if(action==='keygen'){
  if(!input||!output)throw Error('Usage: node tools/release-manifest.cjs keygen /external/private.pem /path/public.pem');
  const privateFile=external(input),keys=crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(privateFile,keys.privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
  fs.writeFileSync(output,keys.publicKey.export({type:'spki',format:'pem'}),{flag:'wx',mode:0o644});
  console.log('Created signing key pair. Keep the private key offline and backed up; only embed the public key.');
 }else if(action==='sign'){
  if(!input||!output||!process.env.SUKOAA_RELEASE_PRIVATE_KEY)throw Error('Usage: SUKOAA_RELEASE_PRIVATE_KEY=/external/private.pem node tools/release-manifest.cjs sign manifest.json envelope.json');
  const payload=fs.readFileSync(input),key=crypto.createPrivateKey(fs.readFileSync(external(process.env.SUKOAA_RELEASE_PRIVATE_KEY)));
  if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 key required');
  const envelope={payload:payload.toString('base64'),signature:crypto.sign(null,payload,key).toString('base64')};
  const config=JSON.parse(fs.readFileSync(path.join(root,'shared/release-channel.json'))),manifest=JSON.parse(payload);
  if(!manifest.artifacts?.length)throw Error('No artifacts');
  for(const artifact of manifest.artifacts)verifyManifest(envelope,config,{currentVersion:require('../desktop/package.json').version,platform:artifact.platform,arch:artifact.arch});
  fs.writeFileSync(output,JSON.stringify(envelope)+'\n',{flag:'wx',mode:0o644});console.log('Signed and verified release envelope. Publish only after the release gate and native signature checks pass.');
 }else throw Error('Expected keygen or sign');
}catch(error){console.error(error.message);process.exitCode=1;}
