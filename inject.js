// inject.js — executes in the real PAGE world (not content script sandbox)
// Loaded via <script src="moz-extension://..."> which bypasses page CSP
(function () {
  if (window.__vbReady) {
    // Already set up — just update gain value if stored
    if (window.__vbGain && window.__vbTarget != null) {
      window.__vbGain.gain.value = window.__vbTarget;
      document.querySelectorAll('audio,video').forEach(function(el) {
        el.volume = Math.min(window.__vbTarget, 1);
      });
    }
    return;
  }
  window.__vbReady = true;

  var ctx = new (window.AudioContext || window.webkitAudioContext)();
  var gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.value = window.__vbTarget != null ? window.__vbTarget : 1;

  var patched = new WeakSet();

  function patch(el) {
    if (patched.has(el)) return;
    patched.add(el);
    try {
      ctx.createMediaElementSource(el).connect(gain);
    } catch (e) {
      // Element may already be connected to another node (e.g. YouTube's own graph)
      // In that case we can't re-route it — nothing we can do without hooking earlier
      console.warn('[VolumeBooster] Could not patch element:', e.message);
    }
  }

  document.querySelectorAll('audio,video').forEach(patch);
  new MutationObserver(function() {
    document.querySelectorAll('audio,video').forEach(patch);
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.__vbCtx = ctx;
  window.__vbGain = gain;

  // Listen for volume commands from content script via CustomEvent
  window.addEventListener('__vbSet', function(e) {
    var v = parseFloat(e.detail);
    if (isNaN(v)) return;
    window.__vbTarget = v;
    if (ctx.state === 'suspended') ctx.resume();
    gain.gain.value = v;
    document.querySelectorAll('audio,video').forEach(function(el) {
      patch(el);
      el.volume = Math.min(v, 1);
    });
  });
})();
