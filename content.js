// content.js — runs at document_start in content script world
// Uses blob URL to inject into page world, bypassing Trusted Types CSP

(function () {
  const pageCode = function () {
    if (window.__vbHooked) return;
    window.__vbHooked = true;

    const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
    if (!OrigAudioContext) return;

    let masterGain = null;
    let masterCtx = null;
    window.__vbTarget = 1;

    const PatchedContext = function (...args) {
      const ctx = new OrigAudioContext(...args);

      if (!masterCtx) {
        masterCtx = ctx;
        masterGain = ctx.createGain();
        masterGain.gain.value = window.__vbTarget;
        masterGain.connect(ctx.destination);

        // Intercept connect() to route audio through our gain node
        const origConnect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (dest, ...rest) {
          if (dest === ctx.destination && this !== masterGain) {
            origConnect.call(this, masterGain, ...rest);
            return this;
          }
          return origConnect.call(this, dest, ...rest);
        };

        window.__vbCtx = ctx;
        window.__vbGain = masterGain;
      }

      return ctx;
    };

    PatchedContext.prototype = OrigAudioContext.prototype;
    Object.defineProperty(window, 'AudioContext', { value: PatchedContext, writable: true, configurable: true });
    if (window.webkitAudioContext) {
      Object.defineProperty(window, 'webkitAudioContext', { value: PatchedContext, writable: true, configurable: true });
    }

    window.addEventListener('__vbSet', function (e) {
      const v = parseFloat(e.detail);
      if (isNaN(v)) return;
      window.__vbTarget = v;

      document.querySelectorAll('audio,video').forEach(function (el) {
        // Always apply native volume (works on YouTube, caps at 1.0)
        el.volume = Math.min(v, 1);

        // For >100%: try to wire element into our own AudioContext + GainNode
        if (v > 1) {
          if (!window.__vbBoostCtx) {
            window.__vbBoostCtx = new (window.AudioContext || window.webkitAudioContext)();
            window.__vbBoostGain = window.__vbBoostCtx.createGain();
            window.__vbBoostGain.connect(window.__vbBoostCtx.destination);
          }
          const ctx = window.__vbBoostCtx;
          const gain = window.__vbBoostGain;
          gain.gain.value = v;
          if (ctx.state === 'suspended') ctx.resume();
          if (!el.__vbCaptured) {
            try {
              ctx.createMediaElementSource(el).connect(gain);
              el.__vbCaptured = true;
            } catch (err) {
              // Already captured by YouTube's own context — can't re-capture
              // Native volume (capped at 1.0) is the best we can do in this case
            }
          }
        } else if (window.__vbBoostGain) {
          window.__vbBoostGain.gain.value = v;
        }
      });
    });
  };

  try {
    const blob = new Blob(['(' + pageCode.toString() + ')()'], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const script = document.createElement('script');
    script.src = url;
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('[VolumeBooster] Injection failed:', e);
  }
})();
