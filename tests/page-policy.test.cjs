// SPDX-License-Identifier: GPL-3.0-or-later
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {youtubeStart}=require('../shared/youtube-start.cjs');
const {mediaStart}=require('../shared/media-start.cjs');
function fixture(host='www.youtube.com') {
 const requests=[];
 const context=vm.createContext({location:{hostname:host,href:`https://${host}/watch?v=content`},URL,Response,console,
 fetch:async(...args)=>{requests.push(args);return new Response(JSON.stringify({videoDetails:{videoId:'content'},streamingData:{formats:[{url:'https://video.example/content'}]},playabilityStatus:{status:'OK'},adPlacements:[{ad:'fixture'}],playerAds:[{}],adSlots:[{}]}),{status:200,headers:{'x-fixture':'yes'}});}});
 vm.runInContext(`(${youtubeStart.toString()})();`,context);
 return {context,run:code=>vm.runInContext(code,context),requests};
}
test('YouTube document-start hook cleans the very first assignment and preserves the video',()=>{
 const f=fixture();
 f.run('ytInitialPlayerResponse={videoDetails:{videoId:"content"},streamingData:{formats:[1]},playabilityStatus:{status:"OK"},adPlacements:[1],playerAds:[2],adSlots:[3]}');
 assert.equal(f.run('ytInitialPlayerResponse.videoDetails.videoId'),'content');
 assert.equal(f.run('ytInitialPlayerResponse.streamingData.formats[0]'),1);
 assert.equal(f.run('"adPlacements" in ytInitialPlayerResponse'),false);
 assert.equal(f.run('"playerAds" in ytInitialPlayerResponse'),false);
 assert.equal(f.run('"adSlots" in ytInitialPlayerResponse'),false);
 f.run('ytInitialPlayerResponse={videoDetails:{videoId:"next"},adPlacements:[1]}');
 assert.equal(f.run('ytInitialPlayerResponse.videoDetails.videoId'),'next');
 assert.equal(f.run('"adPlacements" in ytInitialPlayerResponse'),false);
});
test('JSON revivers and errors are preserved; unrelated objects/hostnames are untouched',()=>{
 const f=fixture();
 assert.equal(f.run('JSON.parse(\'{"videoDetails":{},"playerAds":[1],"keep":3}\',(k,v)=>k==="keep"?v+1:v).keep'),4);
 assert.equal(f.run('JSON.parse(\'{"playerAds":[1],"adSlots":[2]}\').playerAds[0]'),1);
 assert.throws(()=>f.run('JSON.parse("invalid")'),{name:'SyntaxError'});
 assert.equal(fixture('youtube.com.attacker.example').run('typeof __sukoaaEarlyYouTube'),'undefined');
 assert.equal(fixture('unrelated.example').run('typeof __sukoaaEarlyYouTube'),'undefined');
});
test('first player fetch, text and clone are cleaned without replacing Response metadata',async()=>{
 const f=fixture();
 const response=await f.run('fetch("/youtubei/v1/player?key=test")');
 assert.equal(response.status,200);assert.equal(response.headers.get('x-fixture'),'yes');assert(response instanceof Response);
 const clone=response.clone();const payload=await response.json();
 assert.equal(payload.videoDetails.videoId,'content');assert(!('adPlacements' in payload));
 assert(!('playerAds' in JSON.parse(await clone.text())));
 const other=await f.run('fetch("/unrelated-api")');assert('adPlacements' in await other.json());
 assert.equal(f.requests.length,2);
});
test('media waits for user activation, keeps playing across tabs and never resumes a user pause',async()=>{
 const handlers=new Map();let plays=0,pauses=0;
 class Media {play(){plays++;return Promise.resolve();}pause(){pauses++;}}
 const document={hidden:false,addEventListener:(type,fn)=>handlers.set(type,fn),querySelectorAll:()=>[new Media()]};
 const context=vm.createContext({document,HTMLMediaElement:Media,DOMException,console});
 vm.runInContext(`(${mediaStart.toString()})();globalThis.media=new HTMLMediaElement()`,context);
 await assert.rejects(vm.runInContext('media.play()',context),{name:'NotAllowedError'});
 handlers.get('pointerdown')({isTrusted:false});
 await assert.rejects(vm.runInContext('media.play()',context),{name:'NotAllowedError'});
 document.hidden=true;await assert.rejects(vm.runInContext('media.play()',context),{name:'NotAllowedError'});
 document.hidden=false;handlers.get('pointerdown')({isTrusted:true});await vm.runInContext('media.play()',context);assert.equal(plays,1);
 document.hidden=true;handlers.get('visibilitychange')?.();assert.equal(pauses,0,'Hiding a tab does not pause started media');
 await vm.runInContext('media.play()',context);assert.equal(plays,2,'An activated player may continue in the background');
 vm.runInContext('media.pause()',context);document.hidden=false;handlers.get('visibilitychange')?.();assert.equal(plays,2,'Showing a tab never calls play');
 handlers.get('sukoaa-pause-media')();await assert.rejects(vm.runInContext('media.play()',context),{name:'NotAllowedError'});
});
