// SPDX-License-Identifier: GPL-3.0-or-later
// Build a portable AppImage and a Debian package without inventing a project homepage.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const cwd = __dirname;
const pkg = require('./package.json');
const output = path.resolve(cwd, pkg.build.directories.output);
const run = (file,args) => execFileSync(file,args,{cwd,stdio:'inherit'});
if (process.platform !== 'linux' || process.arch !== 'x64') throw Error('Run this x64 Linux build on x64 Linux.');
run(process.execPath,[require.resolve('electron-builder/cli.js'),'--linux','AppImage','--x64']);
const staging = fs.mkdtempSync(path.join(os.tmpdir(),'aegis-deb-'));
try {
  const app = path.join(staging,'opt/AegisBrowser');
  fs.mkdirSync(path.dirname(app),{recursive:true});
  fs.cpSync(path.join(output,'linux-unpacked'),app,{recursive:true});
  const control = path.join(staging,'DEBIAN');
  fs.mkdirSync(control,{recursive:true});
  const size = execFileSync('du',['-sk',app],{encoding:'utf8'}).split(/\s/)[0];
  fs.writeFileSync(path.join(control,'control'),`Package: aegis-browser\nVersion: ${pkg.version.replace('-beta.', '~beta')}\nSection: web\nPriority: optional\nArchitecture: amd64\nMaintainer: Subo\nInstalled-Size: ${size}\nDepends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0, libgbm1, libasound2, libc6 (>= 2.28)\nDescription: Sukoaa Browser desktop preview\n Private tabs, request filtering, cache controls and compatible unpacked extensions.\n Unsigned preview; no automatic application updater.\n`);
  const templates=path.resolve(cwd,'node_modules/app-builder-lib/templates/linux');
  const render=name=>fs.readFileSync(path.join(templates,name),'utf8').replaceAll('${executable}','aegis-browser').replaceAll('${sanitizedProductName}','AegisBrowser');
  fs.writeFileSync(path.join(app,'resources/apparmor-profile'),render('apparmor-profile.tpl'));
  fs.writeFileSync(path.join(control,'postinst'),render('after-install.tpl'),{mode:0o755});
  const remove=render('after-remove.tpl').replace('#!/bin/bash','#!/bin/bash\ncase "$1" in remove|purge) ;; *) exit 0 ;; esac');
  fs.writeFileSync(path.join(control,'postrm'),remove,{mode:0o755});
  const share=path.join(staging,'usr/share');
  fs.mkdirSync(path.join(share,'applications'),{recursive:true});
  fs.writeFileSync(path.join(share,'applications/aegis-browser.desktop'),'[Desktop Entry]\nName=Sukoaa Browser\nComment=Private browsing with request filtering\nExec=/opt/AegisBrowser/aegis-browser %U\nTerminal=false\nType=Application\nIcon=aegis-browser\nCategories=Network;WebBrowser;\nStartupWMClass=aegis-browser\n');
  const icons=path.join(share,'icons/hicolor/512x512/apps');fs.mkdirSync(icons,{recursive:true});
  fs.copyFileSync(path.join(cwd,'assets/aegis.png'),path.join(icons,'aegis-browser.png'));
  const docs=path.join(share,'doc/aegis-browser');fs.mkdirSync(docs,{recursive:true});
  for(const name of ['README.md','LINUX.md','THIRD-PARTY-NOTICES.md']) fs.copyFileSync(path.resolve(cwd,'..',name),path.join(docs,name));
  run('dpkg-deb',['--root-owner-group','-Zxz','--build',staging,path.join(output,`SukoaaBrowser-${pkg.version}-linux-amd64.deb`)]);
} finally { fs.rmSync(staging,{recursive:true,force:true}); }
