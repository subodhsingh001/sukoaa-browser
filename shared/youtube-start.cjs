// SPDX-License-Identifier: GPL-3.0-or-later
// Self-contained: serialized into the main world before site scripts run.
function youtubeStart() {
  if (!/(^|\.)youtube\.com$/i.test(location.hostname) || globalThis.__sukoaaEarlyYouTube) return;
  globalThis.__sukoaaEarlyYouTube = true;
  const adKeys = ['playerAds', 'adPlacements', 'adSlots'];
  function clean(value) {
    if (!value || typeof value !== 'object') return value;
    // Only player responses, never arbitrary JSON or the content's video data.
    if (value.videoDetails || value.streamingData || value.playabilityStatus) {
      for (const key of adKeys) {
        try { delete value[key]; } catch {}
      }
    }
    if (value.playerResponse && typeof value.playerResponse === 'object') clean(value.playerResponse);
    return value;
  }
  const initial = Object.getOwnPropertyDescriptor(globalThis, 'ytInitialPlayerResponse');
  // Respect non-configurable properties and accessor semantics supplied by the site.
  if (!initial || (initial.configurable && !initial.get && !initial.set)) {
    let value = clean(initial?.value);
    Object.defineProperty(globalThis, 'ytInitialPlayerResponse', {
      configurable: true, enumerable: initial?.enumerable ?? true,
      get() { return value; }, set(next) { value = clean(next); }
    });
  } else {
    try { clean(globalThis.ytInitialPlayerResponse); } catch {}
  }
  const parse = JSON.parse;
  JSON.parse = function(...args) { return clean(Reflect.apply(parse, this, args)); };
  const fetch = globalThis.fetch;
  const wrapped = new WeakSet();
  function playerRequest(input) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      return /(^|\.)youtube\.com$/i.test(url.hostname) && /^\/youtubei\/v1\/player\/?$/.test(url.pathname);
    } catch { return false; }
  }
  function wrap(response) {
    if (!response || wrapped.has(response)) return response;
    wrapped.add(response);
    const json = response.json, text = response.text, clone = response.clone;
    // Preserve the native Response (URL/status/headers/body/stream/error semantics).
    try {
      Object.defineProperties(response, {
        json: {configurable:true, value:async function(...args) { return clean(await Reflect.apply(json, this, args)); }},
        text: {configurable:true, value:async function(...args) {
          const result = await Reflect.apply(text, this, args);
          try { return JSON.stringify(clean(parse(result))); } catch { return result; }
        }},
        clone: {configurable:true, value:function(...args) { return wrap(Reflect.apply(clone, this, args)); }}
      });
    } catch {}
    return response;
  }
  if (typeof fetch === 'function') globalThis.fetch = function(...args) {
    const result = Reflect.apply(fetch, this, args);
    return playerRequest(args[0]) ? result.then(wrap) : result;
  };
}
module.exports = {youtubeStart};
