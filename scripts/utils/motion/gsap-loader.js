import { shouldAnimate } from './motion.js';
import loadScript from '../script.js';

const CDN = 'https://cdn.jsdelivr.net/npm/gsap@3/dist';
const pluginPromises = new Map();
let corePromise = null;

const loadCore = () => {
  corePromise ??= (async () => {
    await loadScript(`${CDN}/gsap.min.js`);
    await loadScript(`${CDN}/ScrollTrigger.min.js`);
    window.gsap.registerPlugin(window.ScrollTrigger);
    return { gsap: window.gsap, ScrollTrigger: window.ScrollTrigger };
  })();
  return corePromise;
};

// Resolves to `{ gsap, ScrollTrigger }` once loaded, or `null` when
// shouldAnimate() is false. Callers use the raw GSAP surface directly
// (gsap.to, gsap.timeline, gsap.context, gsap.matchMedia, …) and branch on
// the null return for their own no-animation fallback. Replaced a previous
// callback-with-Promise-fallback wrapper whose return semantics (null vs.
// callback-return-value) made "did animation actually run?" too easy to
// answer wrong (forgotten `return` inside the callback ⇒ undefined ⇒ falsy
// ⇒ fallback runs immediately even while the tween is still playing).
// Memoized so repeat callers share one script load.
export const loadGsap = async () => {
  if (!shouldAnimate()) return null;
  return loadCore();
};

// Memoized per plugin, the same way loadCore() memoizes corePromise: the
// promise is stored before its own await so two concurrent callers requesting
// the same not-yet-loaded plugin share one load+register instead of racing
// (a prior check-then-act on a plain value Map let a second caller read
// `window[pluginName]` before the first caller's script had actually
// finished loading).
const loadPlugin = (pluginName) => {
  if (!pluginPromises.has(pluginName)) {
    pluginPromises.set(pluginName, (async () => {
      await loadScript(`${CDN}/${pluginName}.min.js`);
      const plugin = window[pluginName];
      window.gsap.registerPlugin(plugin);
      return plugin;
    })());
  }
  return pluginPromises.get(pluginName);
};

// Same shape as loadGsap plus the named plugin under its own key.
export const loadGsapPlugin = async (pluginName) => {
  if (!shouldAnimate()) return null;
  const core = await loadCore();
  const plugin = await loadPlugin(pluginName);
  return { ...core, [pluginName]: plugin };
};
