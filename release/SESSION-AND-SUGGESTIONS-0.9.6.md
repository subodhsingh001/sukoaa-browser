# Desktop 0.9.6: restore saved tabs and address suggestions

This desktop update is based on the complete 0.9.5 source. Android code and the Android 0.9.5 APK are unchanged.

## Fixes

- The first window now remains in startup mode until its chrome and initial tabs are ready. Early native focus/close events cannot replace a saved session with an empty or partially restored tab list.
- Closing the last window retains the snapshot captured before its tabs were destroyed. The subsequent application quit cannot replace it with an empty list of window controllers.
- Native address-field suggestions match normal history titles/URLs, bookmarks and previous Google/Bing/DuckDuckGo search terms. Results are deduplicated and limited to eight. Typing suggestions makes no remote search-service request.
- Private and not-yet-identified tab contexts exclude normal history from suggestions. Explicitly saved bookmarks remain available. Private visits remain excluded from persistent history and session restore.
- Clearing history immediately removes its address suggestions. Removing a bookmark removes that suggestion. The native suggestion popup supports mouse and keyboard selection; press Enter to navigate after choosing a value.

## Verification

- 41 Node tests passed, including a regression that fails on the original early-focus session erasure and last-window shutdown erasure.
- Real Electron/Xvfb drag-and-restart check passed: normal tab order, count and selected index restored; private tabs excluded.
- Real normal-close/restart playback check passed: all three URLs restored silently and manual playback/pause behavior retained. The container uses an ALSA null sink because it has no audio hardware.
- Existing native window/editing/tear-off fixture passed.
- Native address-field fixture passed: title/URL matching, keyboard selection, previous searches, private isolation and removal after history clearing.
- These container fixtures do not replace physical Windows-device tests. Public release gates remain unchanged. The Windows installer is unsigned.

## Install and check

Install the 0.9.6 Windows setup over your existing desktop installation. In Settings > Startup, select restoration of your previous session. This update respects an intentionally disabled restore setting. Open two normal tabs, close the browser normally, reopen it and confirm both return. Previously erased snapshots are not reconstructed from unrelated history.

Type part of a visited site's address or title in the address field. Normal search terms and bookmarks can also appear. Private browsing does not save its visits for future suggestions.

## Push to GitHub

The small Changes ZIP contains the changed files at their original repository paths plus a patch against the supplied 0.9.5 source. Copy those folders/files into a clean checkout that already contains 0.9.5, review the changes, commit on a new branch and push. Open a pull request and let Candidate checks run on the NEW commit. A run of an older commit still uses the old source.

Alternatively, copy all contents of the complete Source ZIP's SukoaaBrowser-Source folder into your repository checkout. Preserve .github and .gitattributes. Do not copy the outer folder as an extra nested folder. Review before committing and never force push over unrelated changes.

The D-Bus messages in the reported Linux CI log also appear in passing runs here. The relevant failure was the saved-session timeout; this update does not disable or skip that check. After merging, run the Windows build workflow to generate the same desktop version from GitHub. Attach installers/source under release assets rather than committing binaries to the source tree.
