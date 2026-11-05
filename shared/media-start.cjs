// SPDX-License-Identifier: GPL-3.0-or-later
// No browser APIs or data are exposed in the page world.
function mediaStart() {
  if (globalThis.__sukoaaMediaInstalled) return;
  globalThis.__sukoaaMediaInstalled = true;
  let activated = false;
  const pause = () => {
    activated = false;
    document.querySelectorAll('video,audio').forEach(media => media.pause());
  };
  for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, event => {
    if (event.isTrusted && !document.hidden) activated = true;
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('sukoaa-pause-media', pause);
  document.addEventListener('play', event => {
    if (!activated || document.hidden) event.target.pause?.();
  }, true);
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...args) {
    if (!activated || document.hidden) return Promise.reject(new DOMException('Click play in this tab to start media.', 'NotAllowedError'));
    return Reflect.apply(play, this, args);
  };
}
module.exports = {mediaStart};
