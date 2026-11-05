# Sukoaa 0.9.3 engine maintenance update

This update resolves the engine-check failure reported on 5 November 2026. It preserves the 0.9.2 focus, playback and first-load YouTube filtering changes, plus tab reordering.

| Component | Previous | Updated |
| --- | --- | --- |
| Electron | 45.2.1 | 45.2.3 |
| GeckoView | 159.0.20261022150525 | 159.0.20261102144711 |
| Application version | 0.9.2 | 0.9.3 |
| Android versionCode | 15 | 16 |

The engine check remains enabled and compares the pinned versions with upstream releases. It passed against the upstream metadata retrieved for this build. A future upstream release can make it fail again; that is a request to review and rebuild, not a reason to force the check green.

Electron's official 45.2.2 notes describe Chromium 156.0.8078.80, Node 24.22.2 and native fixes. Its 45.2.3 notes describe additional upstream backports. The GeckoView Maven POM records source revision 7b34a03a910d0385299f4a9f27aa585a786862d8. These references document the maintenance selection; they are not an independent vulnerability assessment or security certification.

- https://releases.electronjs.org/release/v45.2.2
- https://releases.electronjs.org/release/v45.2.3
- https://maven.mozilla.org/maven2/org/mozilla/geckoview/geckoview/159.0.20261102144711/geckoview-159.0.20261102144711.pom
- https://hg.mozilla.org/releases/mozilla-release/rev/7b34a03a910d0385299f4a9f27aa585a786862d8

The packaged-runtime test now checks Electron against the version pinned in package.json rather than a stale hardcoded version. The dependency audit derives GeckoView's version from Gradle and its exact source revision from the retained matching POM. Android POM collection reuses only retained records whose bytes still match their recorded SHA-256 digest. Runtime graphs, lock inventories, notices and bundled legal records were regenerated for the new engines.

Local automated/container tests do not replace physical Windows/Linux/Android testing, an independent security audit, legal/source review or trusted Windows publisher signing. The public-release gate remains blocked. The application update channel is still unconfigured. No universal YouTube ad-blocking or fastest-browser claim is made.
