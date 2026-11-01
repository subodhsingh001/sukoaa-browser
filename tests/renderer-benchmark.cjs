// SPDX-License-Identifier: GPL-3.0-or-later
// Synthetic UI-update microbenchmark, not page-load or cross-browser performance.
const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
app.commandLine.appendSwitch('no-sandbox');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 try {
  const scratch=fs.mkdtempSync('/tmp/sukoaa-render-bench-');
  const entries=Array.from({length:500},(_,i)=>({id:String(i),url:'https://example.test/page/'+i,title:'History entry '+i,time:i}));
  const fixture={tabs:[{id:'one',title:'Example',url:'https://example.test',private:false,blocked:0,zoom:100,device:'desktop',loading:false,lite:false,loadMs:10,back:false,forward:false}],active:'one',total:0,canReopen:false,lab:null,downloads:[],extensions:[],permissions:{private:false,sites:Array.from({length:20},(_,i)=>({origin:'https://site'+i+'.test',camera:'ask',microphone:'ask',location:'ask'}))},settings:{bookmarks:entries.slice(0,60),history:entries,exceptions:[],search:'google',theme:'dark',strict:false,focus:false,restoreSession:true}};
  const preload=path.join(scratch,'preload.cjs');
  fs.writeFileSync(preload,`const {contextBridge}=require('electron');const fixture=${JSON.stringify(fixture)};contextBridge.exposeInMainWorld('aegis',{platform:'linux',command:async()=>fixture,onState:()=>{},onFocus:()=>{},onClosePanel:()=>{}});`);
  const cases=[['baseline',(fs.existsSync(path.join(process.argv.at(-1),'index.html'))?path.resolve(process.argv.at(-1)):path.resolve(__dirname,'bench-baseline'))],['updated',path.resolve(__dirname,'../desktop')]],results=[];
  for(const [name,directory] of cases){
   const win=new BrowserWindow({show:false,width:1360,height:900,webPreferences:{preload,sandbox:true,contextIsolation:true,nodeIntegration:false}});
   await win.loadFile(path.join(directory,'index.html'));
   const result=await win.webContents.executeJavaScript(`(()=>{const s=${JSON.stringify(fixture)};for(let i=0;i<8;i++)render(s);const samples=[];for(let round=0;round<3;round++){const begin=performance.now();for(let i=0;i<60;i++){s.tabs[0].blocked=i;s.total=i;render(s)}samples.push(performance.now()-begin)}return {samples,medianMs:samples.sort((a,b)=>a-b)[1],hiddenHistoryRows:document.querySelector('#history').children.length}})()`);
   results.push({name,...result});win.destroy();
  }
  const report={scope:'Synthetic hidden-panel UI updates only; same Electron engine; 500 history entries, 60 bookmarks, 20 permission sites; 3 rounds of 60 updates; no page/network timing.',results,speedup:results[0].medianMs/results[1].medianMs};
  if(process.env.SUKOAA_BENCHMARK_OUTPUT)fs.writeFileSync(process.env.SUKOAA_BENCHMARK_OUTPUT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});
