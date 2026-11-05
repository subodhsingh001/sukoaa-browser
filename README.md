# Sukoaa Browser — 0.9.1

Desktop update: drag tabs left or right to reorder them. The tab strip scrolls while dragging near either edge. Right-click a tab for Move tab left/right, or move the active tab with Ctrl+Shift+PageUp/PageDown. Moves preserve existing pages and sessions. Regular tab order is restored when session restore is enabled; private tabs remain excluded. Android remains 0.9.0 because its implementation is unchanged. See [release/TAB-REORDERING.md](release/TAB-REORDERING.md).

The Windows installer is unsigned. The internal build explicitly disables publishing; release readiness remains blocked. No public signing approval or Chrome-equivalent security claim is implied.

## Previous desktop update — 0.9.0

Current update: Electron 45.2.1, GeckoView 159.0.20261022150525 (Android code 14), compiled filter startup cache, worker-thread filter updates, bounded filter downloads, production Electron fuse hardening and a disabled-by-default verified application-update channel. Settings → About & updates shows runtime and filter initialization details. See [release/HARDENING-AND-LAUNCH.md](release/HARDENING-AND-LAUNCH.md) for build commands, native/device limits, signing setup and the public-launch process. Public publishing remains blocked; Windows setup is unsigned and Android uses the existing preview signing identity. Speed relative to other browsers remains unverified.

Previous update (0.8.0): Fix this page adds observed diagnostics, a tab/site-specific five-minute filter test, Undo and blocked-link retry. Desktop Comparison Lab displays current, clean and mobile-width sessions side by side with local aggregate measurements. Android includes page help and a guided clean-private comparison. Hidden settings lists render on demand; unchanged preferences skip duplicate disk writes. See release/REPAIR-AND-COMPARISON.txt for scope, validation, benchmark and release limits. Android versionCode is 13.

Renamed from Aegis at the owner's request. Visible desktop/mobile names and the S monogram are updated in this source. Existing internal profile keys, package IDs, native Java namespace, Linux upgrade identity and signing-key alias are intentionally retained for compatibility. Ordinary web screening found no obvious Sukoaa browser collision, but the new name/logo are not legally cleared. See release/BRAND-REVIEW.md.

# Previous update — 0.7.1-beta.1

This source prepares GPL licensing, offline privacy/license screens, a dependency/source inventory, release gates and a signing/security-maintenance procedure. It is NOT cleared for public distribution. The former Aegis name collided with existing browser products. Sukoaa is now selected; its trademark/logo clearance remains pending.

Original application code and project-authored artwork are GPL-3.0-or-later. Third-party terms remain intact. See LICENSE-SCOPE.md, compliance/ and release/. Preferred source was captured for 13 npm runtime dependencies, but converted GPL scriptlet provenance, bundled engine components and the Android transitive graph still have unresolved source review. Audit inventories are not legal clearance.

Desktop permission tests passed with simulated devices and coordinates. Android 0.7.1-beta.1 (code 10) now builds and passes lint (0 errors, 12 warnings); it is signed with the existing preview identity. Real-device checks remain outstanding. Windows is unsigned. The previous validated desktop 0.6.2 / Android 0.6.1 source remains in the source-audit bundle. No public deployment is claimed.

Desktop Menu → Privacy & licenses exposes bundled text offline. Android source adds Privacy & open-source licenses to both native menus. The privacy HTML is ready for review/hosting after publisher contact and final branding are supplied; no public URL has been invented. Executable scriptlet fetches and cached resources are restricted to the recorded reviewed revision/hash. EasyList/EasyPrivacy data updates remain user initiated. Filters do not patch browser engines.

Run `node tools/audit-release.cjs` and `node tools/release-gate.cjs`. The gate must currently fail. Candidate CI never publishes; Dependabot is only configured and needs an actual repository to become active. Do not treat a passing test or a manually flipped approval flag as trademark/legal clearance.

# Desktop 0.6.2 — page zoom and fit width

- **Ctrl + +** (or Ctrl + =) zooms in; **Ctrl + -** zooms out; **Ctrl + 0** resets to 100%. Shortcuts work while focus is in the website or address bar. Mac keyboards use Command instead of Ctrl, but no Mac package is supplied.
- **Menu → Page zoom** offers −, the current percentage/reset button, + and **Fit width**. Range: 25–500%.
- Fit width measures the current page at 100% and shrinks wide content for the current window, down to the 25% minimum. Repeat it after resizing if needed. Responsive websites normally adapt to their available width; very wide fixed layouts may still need horizontal scrolling at the minimum zoom.
- Zoom is isolated to each open tab, including same-origin tabs; a new tab starts at the normal scale. The toolbar stays at its normal size. Zoom is not saved to preferences or linked to private history.
- The page view follows window resizing; tested native content widths include 720, 800 and 1600 pixels. OS display scaling and an actual Windows desktop have not been tested here.
- Windows and Linux desktop packages are **0.6.2**. Android remains **Aegis Next Preview 0.6.1**; its source is preserved in the source archive.

# Desktop 0.6.1 — Windows and Linux history/tab controls

- Windows x64 ZIP, Linux x64 AppImage and Debian amd64 package share desktop version 0.6.1.
- **Menu → Your library → Recent visits**: use **×** beside a visit to delete only that visit. Duplicate visits have separate permanent IDs; existing history is migrated automatically. Clear-all controls remain under Protection.
- The **⌄** button in the tab row opens a searchable list of open tabs. Each row shows its title, address, Regular/Private label and a separate **×** close control. Selecting a row switches to that tab; closing a background tab preserves the selected tab. The list is also under **Menu → Open tabs**.
- Private tabs use separate non-persistent sessions with HTTP cache disabled. Their visits are excluded from history and restored tabs, and storage/cache cleanup is awaited when a private tab closes. Closed-tab callbacks cannot record late visits. Private mode does not delete activity a remote website/account already stored.
- Existing unwanted entries need manual deletion; there is no reliable way to classify old history as formerly private.
- Extract the entire Windows ZIP before launching **Aegis Browser.exe**. Keep the included support files beside the executable. The optional START-DIAGNOSTIC.cmd writes only local diagnostic logs.
- Linux packages are now named **AegisBrowser-0.6.1-linux-x86_64.AppImage** and **AegisBrowser-0.6.1-linux-amd64.deb**. Installation instructions are in LINUX.md.
- Android remains **Aegis Next Preview 0.6.1**, included in this source archive. Its latest APK was delivered separately; this desktop update does not rebuild or change it.

# Android Next 0.6.1 — private history and tab controls

Install the updated **Aegis Next Preview** APK over the existing Next app. This update uses the same package and signing identity. The older app named Aegis Browser is a separate installation.

- **Menu → History**: tap a visit to open it, or **×** beside it to delete just that visit. Clear history removes all visits after confirmation. Visits to the same URL remain separate entries.
- **Tabs**: a scrollable list shows the selected tab, title, address and Regular/Private label. Tap a row to switch; **×** closes that tab, including background tabs. New tab is available at the bottom of the dialog. Normal WebView and advanced Gecko tabs remain in their respective browser screens.
- Private Gecko sessions and their popup children use private settings and cannot write to persistent Aegis history. Closing a private tab closes its session/navigation stack; shared popup site data is cleared when the last tab in that private context closes. Independent private tabs use independent contexts. Normal history is preserved.
- Private address text is excluded from Android view-state saving and autofill, and requests no keyboard personalized learning. Third-party keyboards decide whether to honor the request. This update cannot erase search activity that a website or account has already stored remotely.
- Already recorded visits cannot reliably be identified as formerly private; delete unwanted old entries using their individual **×** buttons.

Validation: history privacy/lifecycle/deletion regression scenarios, release compilation, Android lint and signature verification. No physical Android device/emulator is available; real-device private lifecycle and native list interaction still require verification. Desktop and Linux binaries are unchanged by this Android update.

# Aegis Browser — desktop 0.5.1 / Android Next 0.6 preview

Built for Subo. A real standalone browser project with Windows and Android preview builds, rather than an extension, VPN or DNS changer.

## Use the downloads

**Windows x64:** extract the complete Windows ZIP to a folder, then run `Aegis Browser.exe`. Keep all extracted files together. No Node.js installation is needed for the packaged app. The executable is not publisher-signed, so Windows may display an unknown-publisher warning. This is a test build, not a certified security product.

**Linux x64:** AppImage and Ubuntu/Debian `.deb` downloads are now provided. Use the `.deb` on Ubuntu/Debian for desktop integration and sandbox setup, or mark the AppImage executable and run it as a normal user. Read [LINUX.md](LINUX.md) for install commands, FUSE/sandbox requirements and build instructions. ARM and 32-bit Linux are not included.

**Android 10 or newer:** install the APK only if your device permits it. It is a development-signed release preview, not a Play Store release. Do not disable Play Protect or bypass a harmful-app block. Install-source warnings and harmful-app detections are different; this project cannot guarantee their removal. Android System WebView must be enabled and up to date. You can choose Aegis under Android Settings → Apps → Default apps → Browser app.

Browse sites **inside Aegis** to use its filtering. This does not modify Chrome, Safari, Brave, other apps or the YouTube app. iPhone/iPad builds are not included.

## Desktop 0.5.1 — compact browser chrome

The desktop window uses two rows: tabs with integrated minimize/maximize/close controls, then the address/navigation toolbar. The separate system title row and status/tools row are removed. Inspect and Mobile View are toolbar icons; filtering/private status remains available through the shield tooltip, accessible status text and protection panel. Browser chrome is 86 px tall instead of 118 px plus the previous system title bar. Drag the empty tab-strip area to move the window; double-click the drag region or use the maximize/restore button. An extra device-settings row appears only while responsive preview is active. Windows/Linux desktop packages are updated; the Android UI/APK remains 0.5.0.

## Desktop 0.5 — clean testing, private tabs and extensions

No benchmark has established Aegis as faster than competing browsers, and these features are not claimed to be exclusive. Blocking requests can reduce page work, while bypassing cache often increases repeat-load time. The renderer remains Electron/Chromium.

- **Private button / Ctrl+Shift+N:** labelled top-bar button with a coloured private-state indicator. Each tab has its own non-persistent session: separate cookies, local storage and HTTP cache, excluded from history/session restore, no loaded extensions. HTTP caching is disabled and private HTTP responses receive `Cache-Control: no-store`; site-managed Cache Storage/service workers can still create data within that temporary session. Closing clears its storage/cache. Bookmarks/downloads saved deliberately remain. Separate private tabs do not share sign-ins, so cross-tab login flows may fail.
- **Menu → Tools & extensions → Clean test this page:** opens the current URL in a fresh private session, with HTTP cache disabled and extensions excluded. Useful for checking login-dependent rendering and stale assets.
- **Reload without cached files / Ctrl+Shift+R:** bypasses HTTP cache for a reload. Cookies, local storage and site-controlled service-worker caches are not erased; use Clean test for a new storage context.
- **Lite mode:** per-tab image/media network blocking and reload. This can reduce downloads on image-heavy pages; pictures/video will be missing. Embedded data images and media delivered through other resource types are not guaranteed to be blocked. Separate counters distinguish Lite blocks from ad-rule matches. The displayed load time includes server/network/page time and is not a comparative engine benchmark.
- **Extensions:** add an unpacked folder containing `manifest.json`, review requested access in a native confirmation, then load it into the normal browsing session. The folder must stay in place. Remove it from the list; reload existing pages to remove already-injected content scripts. Configured folders are reloaded at startup, with individual failures shown without blocking browser launch. Compatible popup/options pages have an Open button. No Chrome Web Store/CRX installer, extension sync or automatic extension updates are provided; Chrome API support is partial. Password managers, wallet extensions and arbitrary store add-ons are not certified compatible. File access is disabled and extensions are excluded from private sessions.
- **Example:** `examples/page-lens` is an optional unpacked content-script extension, never automatically installed. It adds a Page Lens button with approximate word count, reading time and viewport dimensions. It makes no network requests and stores no data. The Windows ZIP includes an `examples/page-lens` folder ready to select in the extension manager.
- **Android Next 0.5 is also included.** Its genuine private browsing and mobile add-ons use GeckoView; see the Android Next section below. Mobile add-ons use Firefox-compatible signed XPI packages, not the desktop unpacked/Chrome API loader.

Official Electron extension limitations: https://www.electronjs.org/docs/latest/api/extensions and https://www.electronjs.org/docs/latest/api/extensions-api .

## Desktop 0.4.1 startup fix

- Fixed the 0.4 launch-and-close regression: initial tab layout called Electron's device-emulation reset before a native render-widget view existed. Emulation is now deferred until DOM ready and reset only after it has been applied. Navigation and renderer loss invalidate readiness; ordinary desktop resize/startup never resets an unused emulator.
- Fixed Inspect's bundled frontend being blocked by the session's non-web-protocol policy. Only native Electron DevTools contents may load the internal `devtools://devtools/` resources; ordinary web pages remain blocked from requesting that protocol.
- Responsive presets now use a desktop layout viewport with the requested dimensions, avoiding the mobile emulation API's default 980px layout width. Touch/network/full device emulation remains in the DevTools device toolbar.
- Download and extract the complete new ZIP into a new folder, then run `Aegis Browser.exe`. The status bar identifies version 0.4.1. Keep the existing user profile; deleting app data is unnecessary for this fix.
- `START-DIAGNOSTIC.cmd` is supplied in the Windows ZIP. If launching still fails, it keeps a console open and writes local startup logs under `%LOCALAPPDATA%\AegisBrowser-Diagnostics`. Logs are never sent automatically; review them before sharing because Chromium logs can contain website addresses.
- The Android APK remains at 0.4.0; this is a desktop-only startup fix. The source archive contains the current code for both platforms.

## Desktop 0.4

- Fixed HTML video fullscreen permissions and page bounds. Click the player fullscreen button; Escape exits. F11 toggles the browser window fullscreen. Only the active visible HTTP/HTTPS page can request gesture-based fullscreen; automatic fullscreen remains denied. Camera/microphone permissions now use the 0.7.1 site controls.
- Right-click a website → Inspect element opens Chromium developer tools at the clicked element. Use the Inspect button, F12 or Ctrl+Shift+I to toggle the active page's tools. Elements, Console, Sources and Network use the Chromium DevTools frontend. Sites with their own right-click menu may need a second right-click or F12.
- Mobile view opens a per-tab responsive viewport: phone 390 × 844, compact 360 × 800, or tablet 768 × 1024. The viewport scales to fit the window; Exit preview restores desktop. Tools detach during a device preview to preserve the selected viewport. These presets emulate screen/viewport geometry; use DevTools' device toolbar (Ctrl+Shift+M while tools are focused) for additional device, touch and network settings. They do not reproduce a physical Android/iOS browser.
- Download the new Windows ZIP, extract it into a new folder, close the old Aegis window and launch the new `Aegis Browser.exe`. Keep its supporting files together. The existing application profile is reused; no manual profile deletion is needed.
- Android 0.4 now accompanies the desktop build; see the Android section below.

## Android Next 0.6 — appearance and measured checks

Install the updated Next APK, open **Aegis Next Preview**, then **Menu → Appearance**. The menu has an always-visible Appearance button as well as an appearance list item. The same controls are available in the private/add-on browser.

- **Theme:** Follow system, Light or Dark. The choice is saved and shared between both engines. System night-mode changes are handled without recreating the activities; a theme change applies to existing browser controls and the local new-tab page, preserving the live tab/session objects. Websites retain their own colour rules.
- **Style:** Standard uses simple surfaces; Refined adds rounded address cards, depth and the local new-tab background. Both are ordinary included appearance choices, with no paid tier.
- **Accent:** Mint, Blue or Violet browser accents. Private status keeps a distinct purple indicator in either theme. System bar icon contrast is updated with the theme and restored after fullscreen.
- **Filtering hot path:** uses the already-parsed request host/path instead of reparsing the URL. Fully qualified ad hostnames with a final dot no longer bypass matching. A narrow host/path supplement covers `adservice.google.com/adsid/…`, including after host-list updates, while other Google hosts/paths remain unaffected.
- APK package `com.subo.aegis.next`, versionName **0.6.0**, versionCode **7**, signed with the same Next preview certificate. This updates the existing Next app; the original older Aegis Browser app is separate. Desktop executables remain at 0.5.1.

[Read the complete test report](BENCHMARK-REPORT.md) before making performance or ad-blocking claims. A controlled desktop fixture showed reduced work with protection enabled; that is not a mobile benchmark or Chrome/Brave/Firefox ranking. The small curated Android filtering corpus is not proof of internet-wide ad coverage. Native Android theme/dialog/session behavior and live MSN/YouTube flows still need a device check.

## Android Next 0.5 — private browsing and mobile add-ons

**Install `AegisBrowser-Android-Next-preview.apk`.** It is named **Aegis Next Preview** and uses application ID `com.subo.aegis.next`, version 0.5.0 / versionCode 5. It installs alongside the older `com.subo.aegis` app. The original signing key is unavailable in this workspace, so this is a newly signed preview rather than an in-place update. Keep the old app installed to retain its bookmarks/settings; data is not automatically migrated. A separate private signing backup is retained for future Next-preview updates; it must never be shared or included in the source ZIP.

- Tap the visible **Private** button in the top header, or Menu → New private tab. This opens real GeckoView private mode with separate context IDs. No private history/session list is written by Aegis. Private tabs are not restored after process exit; closing a tab closes its session and requests deletion of its context data. Screenshots/recents previews are blocked throughout the Gecko browser. Private mode does not hide your IP/network activity or erase downloads made elsewhere.
- **Clean test this page** opens the current WebView URL in a fresh Gecko private context. Gecko loads initiated by the address bar/private clean test, and the Reload button, request HTTP-cache bypass. This is not a blanket prohibition on temporary memory caching or site-managed Cache Storage/service workers during arbitrary link navigation.
- The existing regular WebView browser remains the default. **Menu → HTTP cache** toggles its `LOAD_NO_CACHE` setting. It bypasses HTTP caching without isolating cookies, local storage or history. **Menu → Lite mode** disables automatic image loading and reloads; it does not block all video/media delivery paths.
- **Menu → Add-on browser** opens a regular GeckoView tab. Its cookies/site data are separate from regular WebView pages. **Gecko Menu → Install signed Firefox add-on** uses the system file picker to select a Mozilla-signed, Firefox-compatible `.xpi` package (50 MB limit). Gecko validates its signature; Aegis prompts for requested permissions/site/data access. Private access and optional technical/interaction data are not granted. **Manage add-ons** offers supported action popups, enable/disable and removal. Unsupported actions show a message rather than implying full compatibility. Chrome Web Store/CRX packages and arbitrary desktop extension APIs are unsupported.
- Installed user add-ons run only in regular Gecko tabs; they are disabled in private tabs and do not run in the WebView browser. Add-ons are not auto-updated by the app. Obtain signed packages from their trusted Mozilla distribution; no extension is preinstalled automatically.
- The Gecko menu offers **Text mode** (disables page JavaScript and reloads), new regular/private tabs, close all private tabs, and **Clear Gecko cookies & cache**. The latter signs out/reloads Gecko pages and can reset add-on site data. The original WebView clearing dialog only clears WebView pages and explains the separate storage.
- GeckoView 158.0.20261021001945 is bundled, so the APK is substantially larger than the earlier WebView-only build. It supports the bundled ARM64, ARMv7 and x86_64 native libraries with Android 10+ (minSdk 29). It compiles against API 37.2, targets API 36, and uses AGP 9.1.1 / Gradle 9.3.1 / Java 17. Including API 37 at compile time does not require an Android 17 phone.
- GeckoView uses its own native tracking protection, Safe Browsing and HTTPS-only settings; the WebView domain-filter list/script injections do not automatically apply to Gecko. User add-ons can extend regular Gecko protection. No live YouTube ad-removal claim is made. Camera, microphone and location use per-site approval in 0.7.1; certificate checks are not bypassed.
- Gecko bookmarks, upload/download UX, sync and all the original WebView menu features have not been fully ported. This is a preview of the new engine path, not full feature parity. No physical-device/emulator, installed-add-on runtime or Android private-storage isolation tests were available; compiled engine configuration is not a substitute for those checks.
- GeckoView and its components may contact Mozilla/Google infrastructure for engine security/list/add-on services. The app configures no app-specific analytics endpoint or crash-upload service. Gecko engine/security updates require a new APK; keeping Android System WebView current updates only the regular WebView path.

GeckoView private mode API: https://mozilla.github.io/geckoview/javadoc/mozilla-central/org/mozilla/geckoview/GeckoSessionSettings.html . Signed add-on installation API: https://mozilla.github.io/geckoview/javadoc/mozilla-central/org/mozilla/geckoview/WebExtensionController.html .

## Previous Android 0.4

- Fullscreen video now uses a black overlay with hidden system bars, an Exit fullscreen control, and Android Back support. Exiting, navigating, switching tabs or leaving the app restores the browser chrome and releases the fullscreen view. The screen stays awake while fullscreen video is open.
- Rotation is handled without recreating the activity and losing open tabs. Rotation follows the device's orientation settings.
- Menu → Developer inspection offers optional USB inspection from desktop Chrome at `chrome://inspect/#devices`. Enable Android USB debugging and authorize your own computer first. Inspection is off by default, explicitly enabled per app process, and can be disabled from the same menu. It gives the authorized computer access to page content/site data. Android has no built-in desktop-style right-click DevTools panel; the desktop build retains its own Inspect/mobile preview controls.
- APK version 0.4.0, versionCode 4, same `com.subo.aegis` application ID and signing certificate as the earlier preview. Install this APK over the existing preview to keep its app data; do not uninstall first. It remains a development-signed release preview, not a Play Store release.
- Android filtering remains domain/CSS based; desktop session restore, granular clearing and maintained scriptlets have not been ported. YouTube ad removal is not guaranteed.

## Desktop 0.3

- Continue where you left off is enabled by default. Normal HTTP/HTTPS tab URLs and active-tab selection are saved locally and restored. Private tabs are excluded. Change this under Menu → Appearance → On startup.
- Menu → Protection → Clear browsing data now separates history, cache, cookies/site data and saved tabs. Clearing history/cache alone preserves sign-ins; clearing cookies/site data signs you out and resets new-tab shortcuts. Forget saved tabs disables startup restore while leaving current tabs open.
- Added maintained uBlock filters, Quick fixes, Unbreak and Ghostery's converted scriptlet/resource bundle. YouTube scriptlets are applied at DOM ready/load; a scoped helper presses available Skip buttons and hides promoted page cards. These are best-effort improvements. They do not certify that live YouTube video ads are blocked, and do not guarantee removal of unskippable/server-inserted ads. The helper can be disabled in Protection, or paused for YouTube using the per-site switch.
- Filter-list updates now contact both easylist.to and Ghostery's public asset repository on raw.githubusercontent.com. Reload YouTube after updating the rules.
- Android was at 0.2 at this release; desktop session restore and scriptlets are still desktop-only features.

## New in 0.2

- Refined desktop chrome with original vector icons and branded app assets.
- Midnight, Daylight and system appearance, saved across restarts. Changing appearance preserves open websites instead of reloading them.
- A shared new-tab design with local clock, date, engine selector and up to six custom shortcuts. Shortcuts stay on the device; right-click or long-press a custom shortcut to remove it.
- Settings organised into Protection, Your library, Downloads and Appearance. Bookmarks and history can be searched.
- Native Android bottom navigation with back, forward, home, reload, tabs and menu. Larger touch targets and a rounded address bar.
- Android compile/target API 36 and updated build tools. Native Android Back support uses the platform back dispatcher on Android 13+.

## Features

| Feature | Windows | Android |
| --- | --- | --- |
| Address bar and Google search | Yes; also Bing/DuckDuckGo | Yes; also DuckDuckGo |
| Tabs, bookmarks, local history | Yes | Yes |
| Local request blocking | Ghostery parser with EasyList/EasyPrivacy plus uBlock filters/Quick fixes/Unbreak | Conservative unconditional domain subset: 93,731 packaged domains |
| Cosmetic hiding | Filter-list CSS; YouTube-scoped scriptlets/helper | Built-in selectors |
| Per-site pause / Fix this page | Yes | Yes |
| Filter updates | Shield → Update filter lists | Menu → Update filter lists |
| Optional Shorts/recommendation hiding | Yes | Yes |
| Downloads | Save dialog and progress list | Android Download Manager with confirmation |
| Private tabs | Separate ephemeral sessions; no-cache clean testing | Gecko private mode; regular WebView tabs still share cookies |
| Uploads | System picker | Android document picker |
| Site certificate validation | Engine default; never bypassed | Engine default; errors explicitly cancelled |
| Phishing/malware URL service | Not integrated | Android WebView Safe Browsing enabled |
| Camera / microphone / location / notifications | Denied in this preview | Denied in this preview |

The new-tab page lets you choose its search engine; the address bar follows the selected search engine. Android is HTTPS-only; HTTP addresses are rejected instead of silently bypassing security. Desktop permits HTTP with an address-bar warning symbol.

## Limits before public release

This is not a Chromium fork or a security-audited alternative to Chrome/Brave. Desktop embeds Electron/Chromium; Android regular pages embed the installed Android System WebView; Next private/add-on tabs bundle GeckoView. Their capabilities and isolation models differ. Desktop engine/security updates require an updated application build; filter-list updates do not update the browser engine. There is no automatic binary updater in this preview.

Ad blocking is best effort. YouTube pre-roll/mid-roll ad blocking, server-inserted video ads, anti-adblock circumvention, DRM streaming, Google account OAuth sign-in, browser sync and arbitrary Chrome-extension compatibility are **not verified or guaranteed**. Desktop uses network rules and standard cosmetic CSS, with maintained scriptlets enabled specifically for YouTube. Advanced procedural cosmetic selectors and a full document-start injection integration are not provided. Android does not implement full Adblock Plus syntax or its exceptions: it conservatively excludes hosts with domain exceptions when extracting the domain subset. Subresources from service workers or requests without a desktop WebContents ID can escape filtering. Android interception does not cover every request type.

Private browsing does not hide activity from websites, your ISP or your network. History is local plaintext application data, not encrypted storage. Desktop clearing removes only the selected categories; Android still provides the combined clearing option. Bookmarks and downloaded files are preserved. New-tab custom shortcuts use local page storage and are reset when that storage is cleared. Some login/payment flows require third-party cookies, new-window flows or permissions not supported here. Desktop asks before opening a popup; Android Next 0.5.2 opens direct-tap new-window links and offers an Open/Block choice for script-created popup requests. There is no password manager, passkey-management UI, Android tab-session restore or background video/PiP UI in this release. Android activity recreation can reset tabs. Android downloaded files remain in Downloads.

No custom browsing analytics, remote browsing proxy, certificate installation, accessibility service, VPN service or AI API is configured by Aegis. GeckoView and installed add-ons have their own service/network behavior described above. Websites and search engines still receive the requests you send them. Manual desktop rule updates contact easylist.to and raw.githubusercontent.com for the fixed Ghostery asset URLs.

## Build desktop

Install Node.js 22 or newer, then:

```sh
cd desktop
npm ci
npm test
npm start
```

Windows packages: `npm run dist -- --win`. macOS packages on a Mac: `npm run dist -- --mac`. Linux packages on Linux: `npm run dist -- --linux`. macOS/Linux build targets are supplied but were not packaged or tested for this delivery. Signing/notarization requires your own publisher credentials. Do not run a production browser with `--no-sandbox`.

## Build Android

Open `android/` in Android Studio with AGP 9.1.1 / Gradle 9.3.1 support, install Android SDK Platform 37.2 and Build Tools 36.0.0, and use JDK 17. From that folder run `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`). The debug APK appears in `app/build/outputs/apk/debug/`. For a distributable release, configure your own private signing key and keep it out of source control. The supplied Next APK uses the new private development signing identity; it is not a publisher-verified release. The default application ID is `com.subo.aegis.next`. Only use `-PaegisApplicationId=com.subo.aegis` if you have the original app signing key and intend an in-place update.

## Tests and filtering sources

See `TEST-RESULTS.md`. Desktop request matching and navigation tests are under `tests/`. The Linux-only `native-smoke.cjs` harness substitutes sandbox initialization solely to run as root in this restricted headless CI environment; production `desktop/main.cjs` always enables sandboxing. That harness verifies security preferences, not an OS sandbox audit. `FilterRulesTest.java` exercises Android's standalone hostname matcher.

The raw lists in `shared/` are included for attribution, reproducibility and rebuilding the Android domain subset. Run `python tools/refresh-filters.py` to refresh them and regenerate Android assets. This script needs Python 3 and internet access. Lists are from The EasyList authors: https://easylist.to/ . See `THIRD-PARTY-NOTICES.md`.

## Public launch

See `PUBLIC-LAUNCH.md` for store accounts, signing, listing preparation and the release plan. This delivery prepares the project; it does not publish a public website or store listing.

To reproduce the optional UI checks after installing a Playwright Chromium browser, run `node tests/visual-check.cjs` from the project root. Set `AEGIS_CHROME` to a compatible Chrome/Chromium executable if needed. These checks use real new-tab behaviour and a mock shell state for layout; native integration is checked separately.

Desktop saved sessions are local plaintext URLs in application preferences, separate from browsing history. Clear history does not erase the saved-tab list unless Forget saved tabs is also selected. The restore smoke test runs two separate app processes; the YouTube assistance test uses synthetic player data, not real advertising streams.

## Android Next 0.5.2 — article links and popup choices

Install `AegisBrowser-Android-Next-preview.apk`, then launch **Aegis Next Preview**. The top header and About screen show **0.6.0** (versionCode 7). It uses the same `com.subo.aegis.next` package and signing certificate as Next 0.5.0, so it updates that app without uninstalling. The original app named Aegis Browser (`com.subo.aegis`) is a separate installation and will still show its old popup behavior. If external links open that older app, choose Aegis Next Preview in Android's Default apps → Browser app settings.

- Direct taps that request another window open a managed browser tab. Delayed/script-created WebView windows now reach a native **Open link? → Open / Block** dialog instead of disappearing behind the automatic-popup setting. The prompt identifies the containing page; WebView does not supply the destination URL until the new tab is connected.
- Gecko private/add-on tabs now handle the engine's popup prompt with the same explicit Open/Block choice. Approved new windows use the engine's new-session transport instead of manually reloading a URI in the old tab. This supports initially blank windows which a page then fills or navigates using JavaScript.
- Private popup children share their opener's temporary context so the reading flow keeps its private site session. Closing a child does not erase another open tab in the same context; cleanup runs when the last tab in that context closes. Independently opened private tabs still receive separate context IDs.
- One popup decision is displayed at a time. Back/Block, dialog dismissal, engine cancellation and activity destruction reject an unanswered request exactly once. Background-tab requests are rejected. HTTP, local-file, executable and credential-bearing navigations remain disallowed; `about:blank` is permitted for a popup's initial document.
- Normal WebView pages retain the long-press HTTPS link menu: **Open in current tab**, **Open in new tab**, or **Open privately**.

Android release compilation, lint and popup-decision/navigation unit checks passed. The APK signature matches the prior Next build. No physical phone or emulator was available: the actual MSN story flow and dialog/native-window behavior require an on-device check. No claim is made that every website or MSN story has been tested.

## Windows installer

The NSIS Setup.exe installs for the current Windows account, adds Desktop and Start menu shortcuts, and provides a Windows Apps uninstall entry. Profile data is retained on uninstall. Close the portable browser before installing. See release/WINDOWS-INSTALLER.txt. This remains an unsigned internal candidate.

## Site permissions — 0.7.1 beta

Menu → Site permissions controls camera, microphone and location per secure origin, with session/saved decisions and private-tab isolation. Android also requests OS permissions. See release/SITE-PERMISSIONS.txt.

## 0.9.2 focus and playback update

See [the fixes and test limits](release/FOCUS-MEDIA-0.9.2.md) and [the one-branch GitHub upload guide](release/PUSH-0.9.2-TO-GITHUB.txt). Includes the previously supplied tab-reordering change. YouTube first-load fixtures are verified; universal live ad blocking and physical-device behavior remain unverified.
