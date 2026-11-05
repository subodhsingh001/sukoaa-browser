# Desktop tab reordering — 0.9.1

Drag a tab left or right and drop at the highlighted edge. Hold near the edge of an overflowing tab strip to scroll. Drop outside the strip or cancel the drag to keep the previous order. Tabs retain their existing native view, cookies, page state and history. Reordering a background tab preserves the current active tab.

Right-click a tab for Move tab left and Move tab right. These actions disable at the boundaries. Ctrl+Shift+PageUp and Ctrl+Shift+PageDown move the active tab on Windows/Linux; the handler also accepts the Command modifier on macOS, but macOS has not been tested or packaged here.

When session restore is enabled, normal tab order is persisted through the existing session serializer. Private tabs can be moved but never enter persistent session URLs. This does not change private-history/storage cleanup or remove activity held by websites or the operating system.

Implementation: backend validates a known tab ID and an in-range integer final index. It moves the existing object, rather than recreating the tab. Only browser-chrome IPC can request the operation. Drag data from unrelated sources cannot trigger a move. The tab DOM stays keyed by tab ID across state updates. Auto-scroll and drop indicators stop at drag end.

Validation: 33 Node checks; native Electron fixture for real mouse-triggered drag left/right, private movement, live page and storage retention, selection, keyboard movement and drag-cancel cleanup, rejection of unrelated drops and overflow auto-scroll; separate-process session restart check. Existing tab-experience and history/privacy fixtures are also run. The container harness disables the unavailable OS sandbox only inside tests. Production retains sandbox settings.

Build: desktop package 0.9.1, PE metadata derived from package version, internal installer publishing explicitly set to never. Windows installer is cross-built in a Linux container. Updated physical-Windows drag/drop/install/upgrade checks remain required. Android source/build version stays 0.9.0; no Android code change or new APK is claimed.

This is a testing update. Trusted publisher signing, a live verified engine-update channel, completion of source/license/privacy review and a real device matrix remain public-launch requirements. A passing build does not supply these approvals.
