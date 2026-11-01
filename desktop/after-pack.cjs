// SPDX-License-Identifier: GPL-3.0-or-later
// Brand the unsigned Windows executable before signing/distribution.
// Never modify an already signed release: resource changes invalidate its signature.
const fs = require("node:fs");
const path = require("node:path");
module.exports = async function afterPack(context) {
  if (context.electronPlatformName === "linux") {
    // Override the generated AppImage launcher to retain Chromium's sandbox.
    const launcher = path.join(context.appOutDir, "AppRun");
    fs.copyFileSync(path.join(__dirname, "assets/linux-AppRun.sh"), launcher);
    fs.chmodSync(launcher, 0o755);
    await require('./release-fuses.cjs')(context);
    return;
  }
  if (context.electronPlatformName !== "win32") {await require('./release-fuses.cjs')(context);return;}
  const PE = await import("pe-library");
  const ResEdit = await import("resedit");
  const filename = path.join(context.appOutDir, "Sukoaa Browser.exe");
  const exe = PE.NtExecutable.from(fs.readFileSync(filename));
  const resources = PE.NtExecutableResource.from(exe);
  const icon = ResEdit.Data.IconFile.from(
    fs.readFileSync(path.join(__dirname, "assets/aegis.ico")),
  );
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  for (const group of groups)
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries,
      group.id,
      group.lang,
      icon.icons.map((item) => item.data),
    );
  const versions = ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
  for (const info of versions) {
    info.setFileVersion(0, 9, 0, 0, 1033);
    info.setProductVersion(0, 9, 0, 0, 1033);
    info.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        CompanyName: "Subo",
        FileDescription: "Sukoaa Browser",
        ProductName: "Sukoaa Browser",
        InternalName: "Sukoaa",
        OriginalFilename: "Sukoaa Browser.exe",
        LegalCopyright: "Copyright 2026 Subo",
      },
    );
    info.outputToResourceEntries(resources.entries);
  }
  resources.outputResource(exe);
  fs.writeFileSync(filename + ".branded", Buffer.from(exe.generate()));
  fs.renameSync(filename + ".branded", filename);
  await require('./release-fuses.cjs')(context);
};
