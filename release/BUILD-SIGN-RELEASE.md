# Candidate build / signing / distribution procedure

Current publication gate is intentionally BLOCKED. This procedure is not evidence that a publisher identity, public update server or device lab exists.

## Source builds

Desktop: `cd desktop && npm ci && npm test`; run native tests in tests/ on an appropriate desktop. `npx electron-builder --win --x64 --dir -c.win.signAndEditExecutable=false` makes an UNSIGNED Windows candidate. `npm run dist:linux` makes AppImage and Debian packages. Keep runtime LICENSE, LICENSES.chromium.html, third-party notices and source-access materials with every package. Linux Debian pre-release versions use ~beta.

Android: Java 17, Gradle 9.3.1, Android SDK platform 37.2 and build-tools 36.0.0; `./android/gradlew -p android assembleRelease lintRelease bundleRelease`. Export exact runtime graph with the audit init script. Read min/target API from app/build.gradle. Android 0.7.1-beta.1 (code 10) was compiled and linted (0 errors, 12 warnings); the preview signing certificate is unchanged. Physical-device testing and public release clearance remain pending.

## Signing identities

Windows: obtain an eligible trusted publisher certificate/service under the owner's real identity. No Windows certificate has been supplied. Configure the pre-sign evidence and explicit signing authorization, then use tools/sign-windows.ps1 on the owner-controlled Windows release host. Pre-sign and public gates are distinct so the first signature can be made before recording post-sign verification. Verify Authenticode and timestamp validity with SignTool; retain public certificate fingerprint, signed hash, verification output and test evidence. Never upload/export a private key in this project.

Android: the existing Next preview certificate fingerprint is c11b03429beb42a759df1306afbae979cd87b23fb6af05c244bbb7c52edb48f2. Preserve it for Next preview upgrades; do not silently create a replacement key or label it a verified public identity. A private backup already exists separately; it is excluded here. On an owner-controlled build machine, zipalign the release APK and use apksigner with password environment variables rather than command-line secrets; verify signatures and expected public fingerprint. Agree the Play App Signing/upload-key plan before a store release. No newly signed APK is claimed for this candidate.

Linux: a checksum manifest is NOT a digital signature. Use an owner-controlled GPG/minisign identity or the chosen repository's signing scheme, publish the public key through a verified channel, and verify the signature independently. No owner public signing identity has been configured here.

## Publication

First clear the name, contact/source/policy URLs, remaining source obligations, physical tests and signed payloads. Add real evidence under release/evidence and update readiness.json. Run `node tools/release-gate.cjs`; any nonzero result prohibits public publishing by this process. Do not flip flags merely to make the check pass. Prepare artifact hashes and full corresponding source alongside versioned signed packages. Publish via an owner-approved HTTPS/store channel and verify clean installation/update on each platform. No public upload is performed by the supplied candidate workflow.

Weekly dependency checks are configured in .github/dependabot.yml but are inactive until this source is committed to an enabled repository. SECURITY.md defines advisory review, urgent rebuilds, withdrawal, staged release and source retention. No automatic binary updater is implemented; choose and verify a real channel before public launch.

The current GeckoView AAR requires compile SDK 37.2. Install the exact `platforms;android-37.2` package using current Android command-line tools; `platforms;android-37` is a different package ID.
