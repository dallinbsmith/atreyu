// Scroll-progress engine — a faithful vanilla port of Falkor's `useScrollProgress`.
// Drives a `--progress` (0..1) custom property on a tracked element from its scroll
// position, so the *animation lives in CSS* (compositor-friendly transforms/opacity)
// while JS only emits a single number. One shared passive, rAF-throttled scroll
// listener serves every tracked element; an IntersectionObserver gates work to the
// near-viewport. No-op under reduced motion / save-data (the CSS fallback shows the
// resting state), keeping the eager/LCP path and INP budget clean.
import { shouldAnimate } from './motion.js';

const active = new Set();
let raf = 0;
let listening = false;

// Sticky-scrub mapping: 0 when the element top reaches the viewport top, 1 when its
// bottom reaches the viewport bottom (i.e. a tall section scrubs as it is pinned).
const compute = (el) => {
  const r = el.getBoundingClientRect();
  const den = Math.max(r.height - window.innerHeight, 1);
  return Math.min(1, Math.max(0, -r.top / den));
};

const update = () => {
  raf = 0;
  active.forEach((entry) => {
    const p = compute(entry.el);
    entry.el.style.setProperty('--progress', p.toFixed(4));
    entry.cb?.(p);
  });
};

const schedule = () => { raf ||= requestAnimationFrame(update); };

const ensureListeners = () => {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
};

// Track `el`: maintains `--progress` (0..1) on it while it is near the viewport, and
// optionally calls `cb(progress)` for JS-side work (e.g. scrubbing video.currentTime).
// Returns a cleanup function. Under reduced motion it is a no-op.
export const trackScrollProgress = (el, cb) => {
  if (!shouldAnimate()) return () => {};
  const entry = { el, cb };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        active.add(entry);
        ensureListeners();
        schedule();
      } else {
        active.delete(entry);
      }
    });
  }, { rootMargin: '100% 0px' });
  io.observe(el);
  return () => {
    io.disconnect();
    active.delete(entry);
  };
};
