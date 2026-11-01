// SPDX-License-Identifier: GPL-3.0-or-later
const path=require('node:path');
const {flipFuses,FuseVersion,FuseV1Options}=require('@electron/fuses');
module.exports=async function harden(context){
 const platform=context.electronPlatformName;
 const executable=platform==='win32'?path.join(context.appOutDir,'Sukoaa Browser.exe'):
  platform==='darwin'?path.join(context.appOutDir,'Sukoaa Browser.app'):path.join(context.appOutDir,'aegis-browser');
 await flipFuses(executable,{version:FuseVersion.V1,
  [FuseV1Options.RunAsNode]:false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]:false,
  [FuseV1Options.EnableNodeCliInspectArguments]:false,
  [FuseV1Options.OnlyLoadAppFromAsar]:true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:platform==='win32'||platform==='darwin',
  [FuseV1Options.EnableCookieEncryption]:platform==='win32',
  // Required by the existing file:// browser chrome and new-tab assets.
  [FuseV1Options.GrantFileProtocolExtraPrivileges]:true
 });
};
