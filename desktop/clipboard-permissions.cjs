// SPDX-License-Identifier: GPL-3.0-or-later
const {origin} = require('./site-permissions.cjs');

// A website may copy into the system clipboard only while its secure,
// top-level page has focus. This never grants clipboard reading or persists
// a permission, including in private sessions.
function canWriteClipboard(wc, requestingUrl, details = {}, foreground = false) {
  if (!foreground || !wc || wc.isDestroyed() || !wc.isFocused() ||
      details.isMainFrame === false) return false;
  const site = origin(wc.getURL());
  return !!site && origin(requestingUrl) === site &&
    (!details.requestingUrl || origin(details.requestingUrl) === site);
}
module.exports = {canWriteClipboard};
