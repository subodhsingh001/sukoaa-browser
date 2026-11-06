# Sukoaa 0.9.5 — editing, app links and tab windows

This update starts from the latest supplied 0.9.4 source. Desktop version 0.9.5; Android versionName 0.9.5, versionCode 18; application ID and Android signing identity are unchanged.

## Everyday browser behavior

- The address bar and other editable browser fields have native right-click Undo, Redo, Cut, Copy, Paste and Select all menus. The address bar also has Paste and go, which searches if the clipboard contains search text.
- Website text controls and selections have native editing menus. Website menus also expose copy-link, copy-page-address and copy-image actions when appropriate. Programmatic website clipboard reading is still denied; the native Paste action is a user action, not a blanket site permission.
- Drag a tab downward out of the tab strip, or outside the browser, to move the live page to a new full Sukoaa window. The right-click/long-press tab menu also has Move tab to new window. Ctrl+N opens a separate window.
- Moving a tab reuses its existing WebContentsView, preserving its document, form edits, scroll, site storage and private state. Keyboard shortcuts, permission decisions and filtering follow its new owner. Each window has independent tab selection and layout. Stop a Compare session before moving one of its comparison tabs.
- Normal open tabs across windows are included in session URL persistence. Session restore currently brings those URLs back into one window; window grouping and position restoration are not implemented. Private URLs remain excluded. Dropping a tab onto another existing window does not merge the windows.
- The active desktop tab has an accent border, stronger background, bold title and an inset rail. Android's tab list has a marked Current tab row with a border, bold text and accessibility selection state.
- In Android normal and private/add-on modes, Browser menu > Open in app hands an HTTPS page to an installed compatible app. YouTube pages target the installed YouTube app. Tapped supported app/intent links prompt before handing off. Private handoffs require confirmation because the external app can retain its own history. Unsafe local/executable URLs, inherited Intent components/selectors/extras and non-HTTPS fallback URLs are not passed through.

## Verification and limits

37 Node tests passed, plus the standalone Android app-URL policy test. Native Electron fixtures exercise actual context menus and OS pointer drags, transfer of a live page, clipboard contents, new-window keyboard shortcuts, private history isolation, preserved filtering and active-tab styling. Prior history, site-permission, clipboard-button, comparison, focus/playback and reorder fixtures passed. The packaged ASAR is checked separately.

Android compilation and lint pass with 0 errors and 15 warnings. The installed YouTube application's actual handoff still needs testing on a physical Android phone. Desktop native fixtures run in a Linux/Xvfb container with a test-only sandbox exception; production retains its sandbox. They are not real Windows or macOS device tests. Windows Setup remains unsigned. No claim is made that every site's copy protection can be bypassed, all YouTube ads are blocked, or this browser is fastest.

Public-release legal/source, branding/contact, trusted signing, physical-device and update-channel gates remain open. The engine-version check matched the pinned Electron 45.2.3 and GeckoView 159.0.20261102144711 on 6 November 2026.
