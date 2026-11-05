# Sukoaa 0.9.0 — hardening candidate and launch process

This is a local testing candidate. Public distribution is still blocked by release/readiness.json. No public website, store listing, trusted Windows signature or live application-update service was created. This release does not claim to be the fastest browser, block every advertisement, or provide Chrome-equivalent security.

## What changed

- Desktop Electron 45.2.3; Chromium version is displayed in Settings → About & updates. Android private/add-on engine GeckoView 159.0.20261102144711. Regular Android pages use the device's Android System WebView: keep that component and Android updated separately.
- The build ships a compiled filter engine inside app.asar. Valid cache hits avoid reparsing all lists at launch. Changed lists compile in a worker thread; profile caches bind to engine version and input hashes, check size/checksum and replace scriptlet resources from independently verified raw resources. A cache is a performance optimization, not a trusted publisher signature.
- Production Windows/macOS fuse settings restrict loading to app.asar and enable embedded ASAR validation. All platforms disable Electron's RunAsNode, NODE_OPTIONS and Node CLI debugging. File-protocol privileges remain enabled because the existing local browser interface requires them; a future removal needs a tested move to a dedicated application protocol. The WebAssembly trap-handler fuse stays enabled. Windows cookie encryption is enabled. Existing cookies can migrate on write; back up the CLOSED profile before upgrading. Reverting to an older build can make migrated cookies unreadable and require signing in again. Physical Windows migration remains unverified. The local test harness uses --no-sandbox only because of the container; production does not.
- Settings → About & updates displays runtime/filter startup information. The disabled-by-default release channel supports Ed25519-signed metadata, approved HTTPS origins, short expiry, locally remembered highest signed version, bounded downloads and SHA-256. Windows downloads additionally require the configured valid timestamped Authenticode publisher. Installers never run automatically. Native Windows signature verification still requires real Windows testing. This custom updater is not a substitute for an independent security review.

## Reproduce and verify

1. Desktop: install Node 24, then `cd desktop && npm ci && npm test`. Use `node ../tests/filter-startup-benchmark.cjs` for filter initialization only. Native fixture tests run with Electron and a working display; see tests/*-smoke.cjs. Tests exercise private-history isolation, tab focus/title/icon behavior, permissions, clipboard writes, repair comparisons, zoom and packaged ASAR startup.
2. `npm run dist:windows:internal` creates an unsigned NSIS installer for local Windows testing. Public Windows builds need a trusted publisher certificate and timestamp, signing of the runtime AND final installer, and signature verification after packaging. A preview APK signature is unrelated to Windows publisher trust. SmartScreen reputation is separate; signing cannot promise to eliminate warnings immediately.
3. Android: Java 17, verified Gradle 9.3.1, SDK platform 37.2 and build-tools 36.0.0. Run `gradle --no-daemon :app:clean :app:assembleRelease :app:lintRelease :app:bundleRelease`. Resolve the documented AGP compile-SDK compatibility warning before public release, or establish a tested supported toolchain. Align/sign APK and sign AAB using the existing private key outside the project. Existing application identifiers and APK signing identity are preserved for upgrades. Never include keys/passwords in source or CI logs.
4. Run `node tools/audit-release.cjs`; export Android artifacts with `gradle -I ../tools/android-audit.init.gradle :app:exportRuntimeAudit`. Retain exact notices and preferred source. The current npm-runtime audit is only one part of the audit. Electron/Chromium, Android transitives and filter/scriptlet source obligations still need component review.
5. `node tools/check-engines.cjs` checks official Electron/GeckoView release feeds and fails on a mismatch or fetch/parse error. The source includes a daily CI workflow; it only becomes active when this source is installed in your repository. Nothing here is currently monitoring a deployed service.

## Configure a real signed update channel

First complete publisher/legal/contact checks. Use an HTTPS domain you control. Do not substitute placeholder domains, a self-signed certificate, or another publisher's identity.

1. Generate an offline Ed25519 signing key: `node tools/release-manifest.cjs keygen /outside/project/private.pem /outside/project/public.pem`. Private files use exclusive creation and mode 0600; use OS access controls on Windows. Back up securely. Never commit the private key.
2. Set shared/release-channel.json with enabled:true, your HTTPS manifestURL, exact allowedOrigins, PEM publicKey and Windows publisher certificate SHA-1 thumbprint. The thumbprint identifies a trusted Authenticode certificate; artifact digests use SHA-256. Leave automaticChecks:false for manual checks, or deliberately set true for a startup check after 30 seconds. Publish the updated privacy notice before enabling traffic.
3. Create and sign the runtime and final installer first. Produce a JSON payload with schema:1, version:"X.Y.Z", releasedAt/expiresAt ISO timestamps (expiry at most 14 days), notes and artifacts:[{platform:"win32",arch:"x64",url:"https://YOUR_HOST/FILE.exe",size:EXACT_BYTES,sha256:"FINAL_FILE_SHA256"}]. URLs must use approved origins. Add a platform artifact only after that platform is tested.
4. `SUKOAA_RELEASE_PRIVATE_KEY=/outside/project/private.pem node tools/release-manifest.cjs sign payload.json envelope.json`. The tool verifies the signature against the embedded public key before writing. Publish artifact first and envelope last. Refresh signed metadata before expiry. Failed signature, expiry, rollback, digest or publisher checks must stop downloads; never bypass them to repair deployment.
5. Test on real Windows: valid update; wrong key/host/certificate; corrupt/truncated installer; expired/replayed metadata; unavailable network; cancelled download; profile upgrade and rollback. Retain artifact hashes and logs. No installer launches automatically. APKs use the Android store/update process; the desktop updater does not update Android. macOS/Linux production channels need their own native signing/distribution design.
6. Establish offline key backup, revocation/key rotation via a trusted app release, incident response and an accountable release owner. Current checks remember the highest observed release locally; deleting the profile removes that memory. They do not implement a transparency log or a complete TUF update system.

## Where and how to launch

Start with a limited tester group. Then publish only after the release gate passes:

- Your HTTPS website: signed Windows setup, Linux packages if tested, APK when appropriate, matching source ZIP, SHA256SUMS, version/release notes, privacy policy, support/security reporting contact and source/license notices. Checksums alone do not establish who published a file. Use a stable public release host (for example an owner-controlled repository Releases page); temporary chat links are delivery links, not update infrastructure.
- Windows: begin with the signed installer from your site. A Microsoft Store submission is a separate packaging/account/policy step; do not claim Store approval.
- Android: upload the signed AAB to Google Play internal testing using your verified developer account, configure Play App Signing, complete browser permissions/Data safety/content-rating/privacy declarations and all current console requirements, test upgrades, then apply for staged production rollout. An AAB is uploaded to Play, not installed directly by users. The supplied APK is for direct device testing. Verify current Play requirements in the console before submission.
- Linux: publish tested AppImage/DEB with hashes and source/notices through your site or release host. A repository with authenticated metadata and an update process is a separate operational task.

Required retained evidence: name/logo clearance; real support/privacy/security contact; component license/source audit; trusted Windows signatures; verified update channel; real Windows/Linux/Android tests. Do not flip booleans merely because a package builds. Test camera/mic/location, permissions reset, clipboard, MSN links/popups, video/fullscreen, downloads, private history/cache/session isolation and upgrade/uninstall on physical devices. Include an Android 16 KB page-size device/emulator compatibility check for native Gecko libraries before store submission.

## Fair speed and security evaluation

Use the same machine, power mode, engine-age window, network, page set, blocker settings and warm/cold cache conditions. Randomize browser order and run at least ten repetitions. Keep JetStream and Speedometer version fixed and publish full results with spread; report memory, CPU, startup, navigation, responsiveness and breakage separately. JetStream's higher score is better; its subtest timings are not an overall page-loading score. Do not disable sandboxing, HTTPS validation, site isolation or filtering safety to improve scores. Keep Lite mode optional because suppressing media changes what is loaded.

Treat upstream critical patches as urgent: review daily, rebuild and rerun meaningful automated/native/device tests, sign and stage the patch, then roll out with a rollback/incident plan. Set a response target your team can actually staff. Disabling warnings or changing benchmark output is not a performance or security fix.


## Official reference pages (reviewed 2026-11-01)

- Electron releases: https://releases.electronjs.org/
- Electron fuses: https://www.electronjs.org/docs/latest/tutorial/fuses
- GeckoView release metadata: https://maven.mozilla.org/maven2/org/mozilla/geckoview/geckoview/maven-metadata.xml
- Play testing: https://support.google.com/googleplay/android-developer/answer/14151465 (new personal accounts may require a closed test with 12 continuously opted-in testers for 14 days before applying for production access).
- Native Android page-size compatibility: https://developer.android.com/guide/practices/page-sizes

Native tests in this container use simulated devices and a sandbox override confined to test scripts. The packaged-ASAR harness validates bundled/profile caches and worker loading from the final archive; it cannot validate the production OS sandbox here. A direct production launch in this root container is blocked by sandbox restrictions. Full OS sandbox, Windows Authenticode, physical-device performance and Android behavior remain release checks.


Release-gate evidence files must be nonempty regular JSON files under release/evidence/, with check (matching the check name), releaseVersion (0.9.0), status (passed), reviewer, reviewedAt (ISO date) and substantive details. The gate rejects missing, empty, symlinked, future-dated or wrong-version evidence. A file satisfying that schema still needs an honest human review; software cannot establish legal clearance from a self-reported flag.
