# Desktop 0.6.2 zoom — 22 October 2026

- Eleven Node tests and the native history/tab regression passed after the zoom changes. The developer API fake was updated to model the new native zoom methods; production remains pinned to Electron 45.
- Native zoom-smoke.cjs passed real keyboard input for Ctrl+plus/minus/reset in the page and Ctrl+equals/reset in the shell/address bar. Shell chrome stayed at 100%.
- Same-origin normal tabs had independent zoom; menu actions/readout/reset worked; Fit width worked from the visible menu with the page hidden behind it, accounted for the available width excluding a scrollbar, and shrank a tall 1400 px fixture into an 800 px window and repeated Fit remained stable. Normal resizing preserved the selected zoom and native page bounds followed 720 and 1600 px window widths. 25–500% limits passed.
- Private-tab zoom worked without recording history. No zoom preference persistence or per-site private zoom map was introduced. Existing history/privacy and developer regression checks remain part of validation.
- Headless checks do not establish physical Windows keyboard layouts, multi-monitor OS DPI changes, graphical Linux installation or arbitrary website responsiveness.

# Desktop 0.6.1 history/privacy/tab controls — 22 October 2026

- Windows x64 ZIP, Linux x64 AppImage and Debian amd64 package built successfully as 0.6.1. Packaged main/UI/CSS/HTML match the final source. Windows PE file/product version and Aegis branding verified. Windows ZIP integrity/support files verified. AppImage extracted with the expected app archive and sandbox-preserving launcher; Debian version/architecture/extraction and identical app archive verified.
- Eleven existing Node tests passed.
- Native Electron history-tabs-smoke.cjs passed: legacy duplicate visits received distinct IDs persisted to preferences; a real UI delete removed exactly one duplicate; a private search URL was absent from disk history/session; the filtered tab list closed a background private tab while preserving the selected normal tab; private cookies cleared; a fresh private tab had no previous private localStorage; closing a pending page prevented late history; the tab menu fit at 720 px and retained the 86 px/two-row header.
- Native features-smoke.cjs passed: normal/private cookie and localStorage isolation, disabled private HTTP cache, erase-on-close, clean test, hard reload, Lite request blocking, real unpacked MV3 injection with consent, extension exclusion from private tabs/removal, minimum-width and native viewport bounds.
- Root/headless integration harnesses bypass sandbox initialization only inside tests. Production sandbox settings remain enabled.
- Windows launch/SmartScreen, graphical Linux desktop interaction and installation on an actual distro are not established by these Linux headless integration checks. Windows builds remain unsigned previews.

# Android Next 0.6.1 history and tab controls — 22 October 2026

- Final isolated release compilation and lint passed: zero lint errors. APK versionName 0.6.1/versionCode 8, package com.subo.aegis.next. Signature verified against the existing Next certificate. The source snapshot includes the final activity lifecycle guards.

- HistoryRepositoryTest passed with real JSON and an in-memory SharedPreferences interface: legacy entry migration persists unique IDs; a stale dialog removes exactly its selected visit while preserving newer and duplicate visits; private recording leaves stored JSON unchanged. This is a JVM adapter test, not an Android device test.
- VisitHistoryTest exercises regular visits, private searches and popup URLs, late callbacks after private/regular scope close, exact deletion among duplicate URLs, history capping, clear-all and private callbacks after clear-all. Private recording makes zero backend reads/writes; normal history survives private session closure.
- Both engines now route successful visit recording through explicit session scopes; private Gecko scopes are rejected before persistence. Normal WebView callbacks also check tab membership and activity lifecycle before recording. Existing private Gecko session/context cleanup remains in place; no regular-history clearing was added when closing private tabs.
- HistoryRepository migrates legacy entries by assigning stable unique IDs; per-entry deletion reloads current history and removes only the selected ID. This preserves other visits and visits recorded after the dialog opened.
- Both tab lists have independently labelled open and close controls. Normal selected-tab close chooses an adjacent tab; background-tab close retains the selection. The last normal tab creates a fresh home tab; the last advanced tab closes that screen.
- The reported leak was not reproduced on a physical device. The prior private Gecko activity had no Aegis history writer; this change adds an explicit shared privacy gate and OS input-state protections rather than claiming a confirmed root cause.
- No physical Android device/emulator was available. Java regression checks and compilation do not establish keyboard compliance, site/account history deletion, native widget usability or live private context cleanup.

# Android Next 0.6 appearance and blocking checks — 22 October 2026

- Final release compilation and lint passed with no lint errors. Browser JavaScript, English UI text and target-version warnings remain. Android app id remains com.subo.aegis.next; versionName 0.6.0/versionCode 7. Existing Next signing identity is retained.
- ThemePaletteTest passed 36 theme/style/accent/system combinations and 288 text contrast checks (minimum 4.5:1 for tested colours). The initial light-mint colour failed one contrast check; it was darkened and the full palette set then passed.
- Both activities apply saved appearance in place and handle uiMode configuration changes. No recreate/reload/storage-clear call was added to the appearance path. This implementation review is not an on-device session-persistence test.
- Four local new-tab HTML previews (Light/Dark × Standard/Refined) rendered at 390×844 with CSS emitted by the compiled Java helper, with correct scheme, usable search input and no document-width overflow. Captures were inspected internally; they are not native Android screenshots and were not saved as deliverables.
- Domain boundary/final-dot/path/query guard tests, popup decision lifecycle tests and advanced navigation guards passed. A known extracted-list gap was repaired with a narrow Google advertising-integration path rule; unrelated paths/hosts remain allowed.
- The actual desktop paired page-load lab and native popup-handler lab passed. Full raw runs, the small Android matcher corpus, initial/final results and exact limits are in benchmarks/ and BENCHMARK-REPORT.md. The controlled lab is not a mobile or cross-browser ranking; unknown/first-party ad examples still passed through.
- No physical Android device/emulator was available. Native appearance dialogs, system-mode transitions, native widget rendering, live session preservation, battery/memory/startup and real-world MSN/YouTube behavior remain unverified on-device. No fastest-browser, best-blocker or all-ads claim is made.

# Android Next 0.5.2 popup handling — 22 October 2026

- Release `assembleRelease` and `lintRelease` passed on the final source: zero lint errors. The first build caught an indentation issue; the affected code was corrected and formatted, then compilation/lint passed without suppressing the check. Existing target-version/JavaScript/English-text warnings remain.
- Pure-Java checks passed: Open followed by dialog dismissal completes one allow; cancellation/destroy followed by stale Open completes one deny; navigation scheme/credential/private-extension guards and domain-filter boundaries still pass.
- WebView now forwards script-created popup requests to a native Open/Block prompt. The WebView transport receives a never-loaded child, including initially blank windows. Gecko uses PopupPrompt and returns an unopened session to onNewSession; approved script-created windows retain the engine's window-opening semantics. Private child contexts are shared with the opener and cleaned up after the last tab closes.
- APK package `com.subo.aegis.next`, versionName 0.5.2/versionCode 6, non-debuggable release; the signing certificate must match the existing Next preview certificate (c11b03429beb42a759df1306afbae979cd87b23fb6af05c244bbb7c52edb48f2). The original Android app remains separate.
- The final source snapshot was compiled in an isolated build directory. Signing keys/passwords are excluded from source/APK artifacts.
- No physical Android device or emulator was available. Live MSN navigation, direct/delayed/blank-popup behavior, the Open/Block dialog and private window lifecycle have not been verified on-device; Java tests and compilation do not establish those runtime outcomes.

# Desktop 0.5.1 compact chrome — 21 October 2026

- Eleven Node tests passed after the layout change; native bounds now start at y=86 for normal browsing and y=130 during device preview.
- Native Electron headless feature checks passed: header has exactly two rows/86 px, webpage bounds align with the toolbar, controls fit at the minimum 720 px content width, no horizontal overflow, space is reserved for window controls, and accessible status text takes no extra row. Private/caching/Lite/extensions checks still passed.
- Native gesture-driven fullscreen and all three responsive viewports passed; exiting fullscreen/device preview restores the shorter browser chrome.
- The Windows/Linux frame is integrated into the tab row with draggable empty tab-strip regions and trusted shell-only minimize/maximize/close commands. macOS keeps its native traffic lights, with reserved left space, but no Mac package/runtime test is included.
- A native title-bar overlay crashed this root/headless environment during implementation; the shipped Windows/Linux layout uses a frameless window and explicit controls instead. The final native headless feature and viewport checks passed. No Windows machine, graphical X11/Wayland desktop, window-manager drag/resize or native maximize/minimize interaction was available for testing.
- The updated interface was visually inspected using a native shell capture at minimum width. The capture is not a deliverable.
- Android remains 0.5.0; this change targets the desktop window/title/status layout. Existing preview/security/extension limitations below still apply.

# Desktop 0.5 / Android Next 0.5 feature validation — 21 October 2026

- Eleven Node tests passed, including retained startup-readiness guards, native DevTools protocol separation and fullscreen/device lifecycle tests with native API fakes.
- Native Electron startup/browsing smoke passed, including the existing private-session lifecycle and granular data clearing.
- New native `features-smoke.cjs` passed actual cookie/localStorage isolation, private session non-persistence, cacheable asset fetched again during private reload, private storage cleanup on close, fresh second private session, HTTP cache bypass, actual image request blocked by Lite mode, native extension-install confirmation cancellation, MV3 content-script injection into a matching HTTP page, no extension injection in private pages and extension removal.
- The new Tools & extensions page and labelled Private button were checked in the actual Electron shell DOM. No document-width overflow was observed at the headless window's minimum desktop width. A new Chrome screenshot pass could not be run because the headless-browser download returned invalid/truncated archives; no new pixel-level visual approval is claimed.
- No comparative Chrome/Brave/Edge/Firefox performance benchmark, Windows machine launch, physical Android test, or third-party store extension certification was performed. Aegis is not claimed to be the fastest or to have exclusive features. HTTP cache bypass is tested; preventing site JavaScript from using Cache Storage is not claimed.
- Android Next 0.5 APK signature verified (new preview identity), non-debuggable manifest, package/launcher/label/version validated and APK CRC checks passed; ARM64, ARMv7 and x86_64 Gecko libraries plus MPL notices are included. Lint reports zero errors and ten warnings (target-version, JavaScript and English UI text).
- Android Next 0.5 release compile and lint passed with GeckoView 158.0.20261021001945, SDK Platform 37.0 / target 36 / min 29, Build Tools 36.0.0, AGP 9.1.1, Gradle 9.3.1 and Java 17. Native libraries use the same compressed-APK/installed-extraction packaging pattern used by Firefox Android. The compile SDK was upgraded to meet the pinned GeckoView/AndroidX metadata rather than bypassing those checks.
- Android pure-Java tests passed: existing domain-matcher boundary/query cases and new advanced navigation HTTPS/scheme/credential/internal-extension guards.
- Android legacy Back lint incidents are suppressed only on the pre-API-33 fallback methods: both activities explicitly register the native OnBackInvokedDispatcher callback for API 33+, while retaining onBackPressed for Android 10–12. No runtime security setting was disabled to make lint pass.
- No physical-device or emulator test was performed. Gecko private isolation/cleanup, XPI signature validation/permission UI/popups, fullscreen/rotation and cache behavior are implemented against the pinned API and compiled/linted; they are not claimed to have passed on-device runtime verification. Desktop MV3 tests do not validate Android Firefox add-on compatibility.
- Android Next has a new development signing identity and application ID `com.subo.aegis.next`, preserving the older installed app. It is not an in-place update. Original Android 0.4 APK is retained unchanged. Private signing material is excluded from all source/Windows/APK artifacts and saved separately for future Next updates.

## Linux x64 packaging — 21 October 2026

- AppImage extraction passed; packaged main/UI/shared files matched the working source byte-for-byte. Version 0.5.0, the custom sandbox-preserving launcher and desktop entry (no disable-sandbox flag) were verified.
- Debian archive extraction, amd64/version metadata, installer script syntax, root ownership, desktop entry/documentation/AppArmor profile and binary/asar/sandbox hashes matching the AppImage passed. No installed desktop run is claimed.

- Eleven Node tests passed again on Linux, with no failures.
- Native Electron headless feature checks passed: shell startup, private label and Tools UI, private cookie/localStorage isolation and cleanup, HTTP cache bypass, Lite image-request blocking, extension permission cancellation, real MV3 content-script injection, private exclusion and removal.
- The test harness disables sandboxing only for root CI. The distributed app keeps `app.enableSandbox()`; its AppImage launcher is overridden to avoid adding a `--no-sandbox` fallback.
- A normal-user packaged launch could not be attempted: this container rejects `runuser` while setting groups (`Operation not permitted`), before the executable runs. No interactive Linux desktop, real distro installation/uninstallation, Wayland/X11, GPU/video playback, or live-site browsing verification is claimed.
- The `.deb` build uses `dpkg-deb` and the pinned electron-builder sandbox/AppArmor templates; it has no invented homepage or maintainer email, contains apt dependencies, desktop entry/icon and documentation, and preserves user profile data on removal.

## Previous desktop 0.4.1 startup regression validation — 21 October 2026

- Reproduced the 0.4 startup process crash in native Electron. Removing the pre-navigation `disableDeviceEmulation()` call made the same launch/browsing harness pass. This corrects the earlier attribution to host process restrictions: the early emulation reset was the reproduced application regression.
- Native Electron smoke passed after the fix: launch, home, normal/private tab lifecycle, request blocking, bookmarks, per-site pause, sandbox/isolation preferences and granular clear controls.
- Two-process native session test passed: normal URLs and active tab restore; private URLs excluded.
- Eleven Node tests passed, including a regression assertion that neither emulation API may run before DOM ready, a queued preview request applying after readiness, and DevTools internal protocol access permitted only for the native frontend.
- Separate native `viewport-smoke.cjs` passed real Fullscreen API entry/exit, full-window page bounds, media denial, three CSS viewport sizes (390/360/768), per-tab preview state and desktop reset. `inspect-smoke.cjs` passed context-menu Inspect opening a real bundled DevTools frontend for the page. The combined rapid close/reopen DevTools harness did not complete reliably under this headless host; no repeated DevTools lifecycle success or Windows/YouTube playback success is claimed.
- Windows x64 0.4.1 packaged with production sandbox settings enabled. Linux root test harnesses override sandbox initialization only in tests; no production bypass was added. Windows launch and live YouTube playback still require a Windows device.
- Android 0.4.0 APK is unchanged from the prior Android delivery.

## Previous desktop and Android 0.4 validation — 21 October 2026

- Eleven Node tests passed, including a production-main event integration test with native API fakes. It checks active-page-only fullscreen permission; denial of automatic fullscreen, media and background-page requests; full-window video bounds and toolbar restoration; Inspect coordinates and page-targeted DevTools; F12; three emulation presets; per-tab state; tab switching during fullscreen; and rejection of untrusted IPC. Production sandbox/isolation preferences remain enabled.
- Chrome headless UI checks passed for new-tab behaviour, settings, appearance, device preview controls, Inspect button state and the developer toolbar at the minimum desktop width. These UI checks use mock shell IPC, not the Electron renderer.
- The real Electron developer smoke harness is included as `tests/developer-smoke.cjs`. Execution on this run was blocked: Electron renderer subprocesses failed under this host's root/process/socket restrictions before the page loaded. No new live native fullscreen/DevTools/device-emulation success is claimed. The Windows executable was packaged but could not be launched on Windows here. Live YouTube fullscreen must be confirmed on the user's Windows machine.
- Android 0.4 release compilation and lint passed against SDK 36 / Build Tools 36.0.0 / Java 17 / Gradle 8.11.1. Lint has zero errors and six warnings (browser JavaScript support and English-only UI strings).
- Android hostname matcher passed five cases: exact domain, subdomain, sibling boundary, query string safety and malformed input.
- APK signature verified; package `com.subo.aegis`, versionName 0.4.0, versionCode 4, minSdk 29 and targetSdk 36. Signing certificate matches the previous APK (SHA-256 94c5c0d3b8ca415b9569189ea9730a70cce003b803e4ce6f206b378fbf9d515c), allowing an in-place upgrade. Release manifest is not debuggable; optional WebView inspection is off by default and requires explicit UI enablement.
- Android fullscreen, rotation and USB inspection were compiled/linted but were not tested on a physical device or emulator. Live YouTube playback/ads remain unverified. Previous Android 0.2 checks below are historical; no new Android App Bundle was built for 0.4.

## Previous desktop 0.3 / Android 0.2 checks

- Ten Node tests passed, including private-tab exclusion, restore URL validation and YouTube scriptlet availability. The original tests cover: search encoding, URL normalization, dangerous/credential scheme rejection, hostname parsing, actual bundled-list blocking, ordinary-resource allowance, filter exception precedence, and Android list safety checks (some assertions share a test).
- Native Electron headless integration test passed: shell launch, local home loading, tab creation, private-tab flag, private-tab closure, panel visibility, a real advertising subrequest cancelled while the local fixture page stayed usable, bookmarking, per-site exception state, and sandbox/context-isolation/Node-integration preferences.
- Test harness ran as Linux root with its own test-only sandbox initialization override. Production code enables sandboxing. OS-level sandbox effectiveness was not tested in this environment.
- Android domain matcher passed five cases: exact domain, subdomain, sibling-name boundary, unrelated query string, malformed address.
- Android release APK and App Bundle compilation succeeded against Android SDK 36, Build Tools 36.0.0, Java 17, Gradle 8.11.1 and Android Gradle Plugin 8.10.1.
- Android release lint passed with no errors; remaining warnings concern required browser JavaScript support and English-only UI strings.
- Delivered APK signature verified using apksigner; development signing identity, non-debuggable release application.
- Windows x64 application packaged using Electron 45.0.0 and electron-builder. Original app icon and version metadata verified in the PE resources. No Windows machine was available for native launch testing.
- No physical Android device/emulator testing, independent security audit, live YouTube video-ad test, macOS/Linux package verification or iOS build was completed.
- Static UI rendering checked with Chrome headless shell at desktop and phone dimensions: dark/light new-tab pages, protection settings, appearance settings and mobile layout. No horizontal mobile overflow was observed. Native Android chrome was not rendered on a device or emulator.
- New-tab shortcut save/reload, search-engine selection and CSP script execution passed browser checks.
- Desktop appearance updates passed an integration check confirming the loaded website is preserved without reload.

These checks establish a working preview foundation, not production readiness or a guarantee that all ads or malicious websites are blocked.

- The API 36 Android App Bundle was generated for owner signing/testing; it has not been submitted to Google Play.

- Desktop process-restart test passed: two normal tab URLs and their active selection persisted across two separate application launches; a private URL was absent from both saved-session data and history.
- Granular clearing integration passed: history/cache removal preserved a test cookie; cookie/site-data removal erased it; internal reloads did not immediately recreate cleared history; forgetting saved tabs disabled restoration.
- Synthetic YouTube player checks passed: a visible Skip button was clicked, an unrelated button was untouched, a promoted card was hidden and ordinary video content remained visible. A maintained JSON-prune scriptlet removed fixture ad fields while retaining fixture video details.
- No live YouTube video-ad effectiveness claim is made. Early pre-roll ads can still escape the current DOM-ready/load injection path. Unskippable and server-inserted ads are not guaranteed to be blocked.

## Previous Android 0.5.0 article-link handling (superseded)

The Android WebView now sends user-initiated new-window requests to a fresh, hardened tab instead of blocking every request. Automatic/background window requests remain blocked. In the Gecko private/add-on browser, a user-tapped HTTPS new-window link opens in the current tab, preserving its private context. Non-HTTPS navigation remains blocked. MSN article behavior requires verification on a physical phone; this environment has no Android device or emulator.

WebView also offers a long-press link menu: Open in current tab, Open in new tab, or Open privately. This provides an explicit reading path for HTTPS links when a site's script loses its original tap gesture.
