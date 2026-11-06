// SPDX-License-Identifier: GPL-3.0-or-later
// Launches the actual app twice; test-only root/container sandbox exception is in the child harness.
const {spawn,execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),https=require('node:https'),assert=require('node:assert/strict');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sukoaa-restore-media-'));
// Xvfb supplies a display, but hosted Linux runners have no sound card.
// Give only these Electron fixture children a real ALSA null PCM output so
// HTMLMediaElement.play() can resolve without hardware. Keep every playback,
// gesture, mute and restart assertion; never change the production app's audio.
const testAudioEnvironment = {};
if(process.platform === 'linux') {
 const alsaConfig=path.join(profile,'alsa-null.conf');
 fs.writeFileSync(alsaConfig,'pcm.!default { type null }\n',{mode:0o600});
 testAudioEnvironment.ALSA_CONFIG_PATH=alsaConfig;
}
const key=path.join(profile,'fixture.key'),cert=path.join(profile,'fixture.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=www.youtube.com'],{stdio:'ignore'});
const wav=Buffer.alloc(44+44100*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let n=0;n<44100;n++)wav.writeInt16LE(Math.sin(n*2*Math.PI*440/44100)*9000,44+n*2);
const server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(req,res)=>{
 if(req.url==='/tone.wav'){res.setHeader('Content-Type','audio/wav');res.end(wav);return;}
 res.setHeader('Content-Type','text/html');res.end(`<title>Restore fixture ${req.url}</title><button onclick="document.querySelector('audio').play().then(()=>window.started=true).catch(e=>window.playError=e.name+': '+e.message)">Play</button><audio loop autoplay src="/tone.wav"></audio><script>document.querySelector('audio').play().catch(e=>window.initialBlock=e.name)</script>`);
});
async function run(phase,origin){
 const child=spawn(path.resolve(__dirname,'../desktop/node_modules/electron/dist/electron'),['--no-sandbox',path.join(__dirname,'restore-playback-runtime.cjs')],{env:{...process.env,...testAudioEnvironment,SUKOAA_RESTORE_PROFILE:profile,SUKOAA_RESTORE_PHASE:phase,SUKOAA_RESTORE_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>{logs+=b;});child.stderr.on('data',b=>{logs+=b;});
 const timeout=setTimeout(()=>child.kill('SIGKILL'),60000);
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});clearTimeout(timeout);
 assert.equal(code,0,phase+' failed: '+logs.slice(-4500));console.log(logs.split('\n').filter(x=>x.startsWith('PASS')).join('\n'));
}
(async()=>{try{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`https://www.youtube.com:${server.address().port}`;await run('save',origin);await run('restore',origin);}finally{server.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
