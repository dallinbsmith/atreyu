import { shouldAnimate } from './motion.js';
import loadScript from './script.js';

const CDN = 'https://cdn.jsdelivr.net/npm/gsap@3/dist';
const plugins = new Map();
let corePromise = null;

const loadCore = () => {
  corePromise ??= (async () => {
    await loadScript(`${CDN}/gsap.min.js`);
    await loadScript(`${CDN}/ScrollTrigger.min.js`);
    window.gsap.registerPlugin(window.ScrollTrigger);
    plugins.set('ScrollTrigger', window.ScrollTrigger);
    return { gsap: window.gsap, ScrollTrigger: window.ScrollTrigger };
  })();
  return corePromise;
};

export const withGsap = async (callback) => {
  if (!shouldAnimate()) return null;
  const core = await loadCore();
  return callback(core);
};

export const withGsapPlugin = async (pluginName, callback) => {
  if (!shouldAnimate()) return null;
  const core = await loadCore();
  if (!plugins.has(pluginName)) {
    await loadScript(`${CDN}/${pluginName}.min.js`);
    const plugin = window[pluginName];
    window.gsap.registerPlugin(plugin);
    plugins.set(pluginName, plugin);
  }
  return callback({ gsap: core.gsap, [pluginName]: plugins.get(pluginName) });
};
