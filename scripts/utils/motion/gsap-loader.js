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

export const withGsap = async (callback) => {
  if (!shouldAnimate()) return null;
  const core = await loadCore();
  return callback(core);
};

// Memoized per plugin, the same way loadCore() memoizes corePromise: the promise
// is stored before its own await, so two concurrent callers requesting the same
// not-yet-loaded plugin share one load+register instead of racing (a prior
// check-then-act on a plain value Map let a second caller read `window[pluginName]`
// before the first caller's script had actually finished loading).
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

export const withGsapPlugin = async (pluginName, callback) => {
  if (!shouldAnimate()) return null;
  const core = await loadCore();
  const plugin = await loadPlugin(pluginName);
  return callback({ gsap: core.gsap, [pluginName]: plugin });
};
