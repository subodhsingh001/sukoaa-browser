# Sukoaa 0.9.4: keep started media playing across tabs

This update replaces the 0.9.2/0.9.3 single-playing-tab rule, following the requested behavior. It retains the 0.9.3 engine patches, tab reordering, new-tab focus repair and early YouTube filter.

## Playback

- A freshly opened or restored document requires user interaction before playback. Restoring saved YouTube URLs does not grant playback permission.
- Once the user starts media, hiding its tab or selecting another tab no longer pauses it or revokes its playback activation. Desktop user mute remains independent of activation. More than one tab can play if the user deliberately starts each one.
- Tab selection never calls Play. A manually paused video stays paused when switching tabs.
- Navigating to a new document resets that document's playback activation. An in-page navigation keeps the document's existing state.
- Android normal tabs no longer call WebView.onPause or mute when switching tabs. Gecko tabs disable suspendMediaWhenInactive and no longer pause other tabs from the media delegate.
- Leaving an Android browsing activity still uses the app lifecycle pause/mute path. Background audio outside the browsing activity, across normal/private activities or while the phone is locked is not a guaranteed foreground-service feature. Android/YouTube may impose additional device/site restrictions. Physical-device verification is required.
- The bundled Gecko policy extension version is increased to 1.1.0 so ensureBuiltIn can update existing installations instead of retaining the previous visibility-pause script. It remains local, with no native messaging, telemetry or remote script downloads.

## Tab actions

Desktop: hold a tab for 600 ms, right-click it, or focus it and press Shift+F10 / the Menu key. The menu contains New tab, New private tab, Duplicate, Mute/Unmute, Move left/right, Reopen closed tab, Close tab, Minimize window and Maximize/Restore window. A short click selects; pointer movement cancels the hold so dragging still reorders tabs. Creating a second independent browser window is not included in this update.

Android: open the tab list, then hold a tab row or tap its visible three-dot button. Choose New tab, New private tab, Duplicate or Close. Duplicating a private Gecko tab preserves private mode.

## Verification

37 Node tests passed. Real Electron fixtures verify long-press/right-click/keyboard actions, short-click cancellation, initial autoplay blocking, background playback retention, manual pause retention, new-tab focus, early YouTube fixture filtering, tab reordering and tab title/icon behavior. A separate test launches the application twice with the same profile and a live local HTTPS fixture, proving that three saved media pages restore silently and require user Play again.

The generated APK and Windows installer are internal test candidates. APK signing and packaging checks are recorded in verification-0.9.4.json. There is no physical Windows/Android certification or universal live YouTube ad-blocking guarantee. Windows publisher signing, legal/source/branding review and production-update setup remain open; public-release gates stay blocked.
