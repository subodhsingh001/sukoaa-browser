// SPDX-License-Identifier: GPL-3.0-or-later
// Local-only address suggestions. Never queries a remote search service.
(function(root) {
  function addressSuggestions(query, history = [], bookmarks = [], privateMode = false) {
    const term = String(query || '').trim().toLocaleLowerCase().slice(0, 256);
    const candidates = [];
    const sources = [
      ...bookmarks.map(row => ({...row, bookmark:true})),
      ...(privateMode ? [] : history).map(row => ({...row, bookmark:false}))
    ];
    for (const [index, row] of sources.entries()) {
      let url;
      try { url = new URL(row.url); } catch { continue; }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      let value = url.href;
      if (!row.bookmark && ((['www.google.com','google.com','www.bing.com','bing.com'].includes(url.hostname) && url.pathname === '/search') ||
          (['duckduckgo.com','www.duckduckgo.com'].includes(url.hostname) && url.pathname === '/'))) {
        value = url.searchParams.get('q')?.trim() || value;
      }
      if (!value || value.length > 8192) continue;
      const title = String(row.title || url.hostname).slice(0, 180);
      const lower = value.toLocaleLowerCase(), label = title.toLocaleLowerCase();
      const hostname = url.hostname.replace(/^www\./,'').toLocaleLowerCase();
      if (term && !lower.includes(term) && !label.includes(term) && !hostname.includes(term)) continue;
      const score = !term ? 0 : hostname.startsWith(term) ? 0 : lower.startsWith(term) ? 1 : label.startsWith(term) ? 2 : 3;
      candidates.push({value, label:(row.bookmark ? 'Bookmark · ' : '') + title, score, index});
    }
    candidates.sort((a,b) => a.score-b.score || a.index-b.index);
    const seen = new Set(), result = [];
    for (const row of candidates) {
      const key=row.value;
      if (seen.has(key)) continue;
      seen.add(key);result.push({value:row.value,label:row.label});
      if (result.length === 8) break;
    }
    return result;
  }
  if (typeof module === 'object' && module.exports) module.exports = {addressSuggestions};
  else root.sukoaaAddressSuggestions = addressSuggestions;
})(globalThis);
