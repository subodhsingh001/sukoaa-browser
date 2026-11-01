// SPDX-License-Identifier: GPL-3.0-or-later
const {nativeImage}=require('electron');
const {faviconURL}=require('./tab-tools.cjs');
async function tabIcon(tab, candidates, changed) {
  const wc=tab.view.webContents, page=wc.getURL();
  const revision=tab.iconRevision=(tab.iconRevision || 0)+1;
  for(const value of [...new Set(candidates)].slice(0,4)) {
    const url=faviconURL(value,page);if(!url)continue;
    try {
      const response=await wc.session.fetch(url,{credentials:'omit',redirect:'error',
        cache:tab.private?'no-store':'default',signal:AbortSignal.timeout(5000)});
      if(!response.ok || !/^image\/(png|jpeg|webp|gif|x-icon|vnd.microsoft.icon)(;|$)/i.test(response.headers.get('content-type') || ''))continue;
      if(Number(response.headers.get('content-length'))>524288){await response.body?.cancel();continue;}
      const reader=response.body.getReader();let size=0;const chunks=[];
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;
        if(size>524288){await reader.cancel();throw Error('Icon too large');}chunks.push(Buffer.from(value));}
      const image=nativeImage.createFromBuffer(Buffer.concat(chunks));const dimensions=image.getSize();
      if(image.isEmpty() || dimensions.width>1024 || dimensions.height>1024)continue;
      if(tab.closed || wc.isDestroyed() || wc.getURL()!==page || tab.iconRevision!==revision)return;
      tab.favicon=image.resize({width:20,height:20}).toDataURL();changed();return;
    } catch {}
  }
}
module.exports={tabIcon};
