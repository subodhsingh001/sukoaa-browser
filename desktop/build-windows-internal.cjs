// SPDX-License-Identifier: GPL-3.0-or-later
// Build an unsigned internal candidate. This does not satisfy public release gates.
const path = require('node:path');
process.chdir(__dirname);
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
if (process.platform === 'linux') {
  // Use electron-builder's own NSIS reader (also used by its macOS fallback).
  // It extracts the intermediate uninstaller without running Windows code.
  const {WineVmManager} = require('app-builder-lib/out/vm/WineVm');
  const {UninstallerReader} = require('app-builder-lib/out/targets/nsis/nsisUtil');
  const original = WineVmManager.prototype.exec;
  const output = path.resolve(__dirname, '../build/desktop');
  WineVmManager.prototype.exec = async function(file, args, options) {
    if (path.dirname(file) === output && path.basename(file) ===
        `SukoaaBrowser-${require('./package.json').version}-Windows-x64-Setup.exe` &&
        args.length === 0) {
      await UninstallerReader.exec(file, file.replace(/exe$/, '__uninstaller.exe'));
      console.log('Extracted NSIS uninstaller with bundled reader; no Windows execution');
      return '';
    }
    return original.call(this, file, args, options);
  };
}
// Keep resource-writer staging files out of the Windows runtime archive.
const archiver=require('app-builder-lib/out/targets/archive');
const archive=archiver.archive;
archiver.archive=async function(format,outFile,dir,options={}) {
  if(path.basename(dir)==='win-unpacked' && outFile.endsWith('.nsis.7z'))
    options={...options,excluded:[...(options.excluded || []),'.electron.exe.*','.Sukoaa Browser.exe.*']};
  return archive(format,outFile,dir,options);
};
const {build, Platform, Arch} = require('electron-builder');
build({publish:'never',...(process.env.SUKOAA_PREPACKAGED ? {prepackaged:path.resolve(process.env.SUKOAA_PREPACKAGED)} : {}),targets:Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  config:{win:{signAndEditExecutable:false}}}).catch(error=>{
    console.error(error); process.exitCode=1;
  });
