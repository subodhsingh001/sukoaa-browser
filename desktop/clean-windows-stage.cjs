// SPDX-License-Identifier: GPL-3.0-or-later
// Remove only executable-write staging files before creating the installer archive.
const fs=require('node:fs'),path=require('node:path');
module.exports=async function() {
 const dir=path.resolve(__dirname,'../build/desktop/win-unpacked');
 if(!fs.existsSync(dir))return;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true}))
  if(entry.isFile() && /^\.(?:electron|Sukoaa Browser)\.exe\./.test(entry.name))
   fs.unlinkSync(path.join(dir,entry.name));
};
