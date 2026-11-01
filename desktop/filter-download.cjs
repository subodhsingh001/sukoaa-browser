// SPDX-License-Identifier: GPL-3.0-or-later
// Bound response bytes before decoding; reject redirects instead of trusting a new host.
async function fetchFilterText(url,fetchImpl=fetch){
 const parsed=new URL(url);
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||!['easylist.to','raw.githubusercontent.com'].includes(parsed.hostname))throw Error('Unapproved filter source');
 const limit=20000000,response=await fetchImpl(url,{redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok||Number(response.headers.get('content-length'))>limit)throw Error('Filter download rejected');
 const chunks=[],reader=response.body.getReader();let size=0;
 for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>limit){await reader.cancel();throw Error('Filter download exceeds size limit');}chunks.push(Buffer.from(item.value));}
 if(size<1000)throw Error('Invalid filter list');return Buffer.concat(chunks).toString('utf8');
}
module.exports={fetchFilterText};
