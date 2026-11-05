# Sukoaa 0.9.2: focus, playback and initial YouTube filtering

Based on GitHub main e8c0c7c63c7093c316ee6745c1609aa82fdcb253 plus the previously supplied 0.9.1 tab-reordering patch. The complete source includes both changes. Desktop version 0.9.2; Android version 0.9.2, versionCode 15; Android application ID remains com.subo.aegis.next.

## Changes

- New-tab and private-tab address focus is restored when the embedded page finishes loading, preserving the text already typed. Touching the page or navigating cancels the pending focus request.
- Media requires interaction in the page. Switching away pauses media and mutes background tabs. Returning to a paused tab does not call play. The desktop's user mute setting remains separate from background muting.
- Android resumes only the current WebView. Gecko tabs suspend media while inactive and use the native media delegate to pause/mute background playback. Leaving either Android activity pauses its tabs.
- A narrowly scoped, original YouTube player-data hook runs at document start. It removes known ad fields from player responses while retaining the video, playback status and formats. It handles initial assignment, JSON parsing and player-fetch response methods. Existing request filters, maintained desktop scriptlets and skip assistance remain in place.
- Desktop protection exceptions and the YouTube-protection switch bypass the early YouTube hook. WebView exceptions and temporary repair pauses are reflected before app-requested reloads. Android's protection information reports whether its installed WebView supports early scripts and native background audio muting.
- The same shared script source generates desktop and Android assets with `node tools/sync-page-scripts.cjs`. The Gecko built-in policy has no native messaging, telemetry, storage or remote script loading. User-installed extensions remain excluded from private tabs.

## Evidence and limits

Node tests and real Electron local fixtures cover first-inline-script filtering, initial playback blocking, trusted Play clicks, tab switching, user mute, new-tab/private-button focus and draft preservation. These fixtures are reproducible; they are not measurements of live YouTube ad coverage.

YouTube changes its player and ad delivery. Server-stitched ads and account/region/experiment differences can still produce ads. No universal or 100% YouTube-blocking claim is made. Keep filters and engines updated. Older Android WebViews without DOCUMENT_START_SCRIPT only receive the existing later filtering; without MUTE_AUDIO, DOM pause/gesture controls provide the fallback. Update Android System WebView for both capabilities.

Android compilation, lint and signing do not replace physical-device tests. Windows packaging and integrity checks do not replace installation/playback tests on a real Windows computer. A trusted Windows publisher certificate is still not configured. Public-release gates, source/legal review, branding clearance and the verified security-update process remain open.

## Test on your devices before publishing

1. Install the updated APK over the earlier com.subo.aegis.next app without uninstalling, using its original signing identity. Confirm version 0.9.2 in Android settings. Back up anything important separately.
2. Tap New tab and type immediately. Repeat in private mode and after returning from another app. The draft must survive the home page finishing. Touch the page deliberately: it must retain focus afterward.
3. Open three YouTube URLs. They must wait for a tap instead of starting together. Start a video, switch tabs, then return: it must remain paused until you choose Play. Repeat in private/add-on mode and while switching between normal and private activities.
4. Visit a YouTube video for the first time in a clean private tab. Record whether ads appear, the app/engine version, normal/private mode, region and signed-in state. Do not share private account details. A fixture pass does not establish real ad coverage.
5. Check fullscreen, clipboard buttons, site permissions, MSN stories, downloads, history deletion, tab dragging and Ctrl +/-/0 on Windows. Confirm private URLs are absent from normal history after closing private tabs.

The 2026-11-05 engine check detected newer patch releases (Electron 45.2.3 and GeckoView 159.0.20261102144711) than the bundled versions. Upgrade and retest engines before public distribution. See verification-0.9.2.json for the captured check and current limitations.
