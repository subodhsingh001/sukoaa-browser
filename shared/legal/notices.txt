# Sukoaa third-party notices

Sukoaa is the renamed project formerly called Aegis. Original application code and project-authored artwork are GPL-3.0-or-later, copyright 2026 Subo. See LICENSE-SCOPE.md. Third-party authors retain their rights and licenses; no affiliation or endorsement is implied. No trademark rights are granted. This candidate is not cleared for public launch.

## EasyList / EasyPrivacy

The EasyList authors (https://easylist.to/). The upstream lists retain timestamps and attribution. https://easylist.to/pages/licence.html offers GPL-3.0-or-later or CC-BY-SA-3.0-or-later. We select the CC-BY-SA option for these list files and the modified domain-only lists in shared/domains.txt and Android assets. Preserve attribution, indicate the extraction changes and apply the corresponding ShareAlike terms to that data. License text is retained in shared/LICENSE-CC-BY-SA.txt and Android assets.

## uBlock resources

GPL-covered uBlock filter/scriptlet data is retained in shared/ublock with its licenses. The exact mirrored files match Ghostery/adblocker commit 7f5784d0a1dc177171ee3d6d39a7e4ac7a7eecec. Provenance and hashes are in shared/filter-provenance.json. The original application is conservatively licensed as GPL-3.0-or-later to avoid relying on a proprietary-separation exception. The converted/minified scriptlet bundle's preferred-form upstream source and conversion mapping remain unresolved; simply preserving these licenses or the converted JSON is not treated as complete corresponding source. This is a public-release blocker.

Upstream: https://github.com/uBlockOrigin/uAssets and https://github.com/gorhill/uBlock . Mirror: https://github.com/ghostery/adblocker . Executable updates are pinned and hash checked; EasyList data updates are separate.

## Runtime npm libraries

Ghostery adblocker, adblocker-content, extended-selectors and url-parser plus the @remusao compression/URL helpers use MPL-2.0. tldts, tldts-core and tldts-experimental use MIT. Their exact installed versions, license-file hashes, npm integrity and exact npm gitHead source archives are recorded in compliance/. Thirteen runtime packages have matching source snapshots in the source-audit companion. Original notices remain in node_modules and preferred source archives. Covered MPL source remains available under MPL; original application licensing does not remove its terms.

## Desktop runtime

Electron 45.2.1 is MIT. Preserve the runtime's LICENSE and LICENSES.chromium.html. Chromium and its 498 retained notice entries have individual licenses and possible corresponding-source obligations. The component inventory does not assert legal clearance. Exact runtime/Chromium source and copyleft component review remain release blockers. No proprietary media/codec or worldwide patent clearance is claimed.

## Android

Regular pages use the device's Android System WebView; Sukoaa does not redistribute that engine. Private/add-on pages redistribute unmodified GeckoView 159.0.20261022150525 under MPL-2.0 and bundled third-party terms. Mozilla revision: 5add844c26613d7e4d84c799d6e23cf987b1240d at https://hg.mozilla.org/releases/mozilla-release/rev/5add844c26613d7e4d84c799d6e23cf987b1240d . Maven/source artifacts: https://maven.mozilla.org/maven2/org/mozilla/geckoview/geckoview/159.0.20261022150525/ . MPL text is in Android assets. Exact Android transitive/runtime source review remains pending the build graph. AndroidX/Kotlin and Gradle wrappers retain their own notices; no blanket relicensing is intended.

AndroidX WebKit 1.18.0 is distributed under Apache-2.0. The resolved Android artifact inventory and POM license declarations are in compliance/android-runtime.json and compliance/android-license-metadata.json. AndroidX source artifacts/notices are retained where available; the all-component corresponding-source review remains open. The bundled media and YouTube page policy is original Sukoaa code under GPL-3.0-or-later.

## Build tools and trademarks

resedit and pe-library retain MIT terms. electron-builder and other build tools are inventoried separately; they are not all shipped in the runtime. Build wrappers retain Apache notices. Google, Chrome, Brave, Mozilla, Android, YouTube and other marks belong to their respective owners; compatibility references do not imply endorsement. The S shield is project-authored; it has not been cleared as a trademark or registered.
