// Button-behavior registry: tagger (eager/sync) + phased runner.
// Heavy behavior logic lives in ./behaviors/*.js and is lazy-imported via init thunks.

const registry = new Map();

export const registerBehavior = (name, { match, phase, init }) => {
  registry.set(name, { match, phase, init });
};

// Pure + sync: stamp the first matching behavior onto the link. No imports.
export const tagBehavior = (a) => {
  for (const [name, { match, phase }] of registry) {
    try {
      if (match(a)) {
        a.dataset.behavior = name;
        a.dataset.phase = phase;
        return name;
      }
    } catch { /* malformed href — skip */ }
  }
  return null;
};

const resolve = async (init) => {
  const result = init();
  if (typeof result?.then !== 'function') return result; // inline sync fn
  const mod = await result;
  return mod.default;
};

export const runBehaviors = async (phase, root = document) => {
  const links = root.querySelectorAll(`a[data-phase="${phase}"]:not([data-behavior-init])`);
  await Promise.all([...links].map(async (a) => {
    a.dataset.behaviorInit = '';
    const entry = registry.get(a.dataset.behavior);
    if (!entry) return;
    try {
      const fn = await resolve(entry.init);
      fn?.(a);
    } catch { /* leave native href intact */ }
  }));
};

registerBehavior('phone', {
  match: (a) => a.href.startsWith('tel:'),
  phase: 'eager',
  init: () => () => {}, // native tel: link — no enhancement needed
});

registerBehavior('consent', {
  match: (a) => a.href.includes('/widgets/consent'),
  phase: 'lazy',
  init: () => import('./behaviors/consent.js'),
});

registerBehavior('download', {
  match: (a) => a.href.includes('/widgets/download'),
  phase: 'lazy',
  init: () => import('./behaviors/download.js'),
});

registerBehavior('outlook', {
  match: (a) => a.href.includes('/widgets/outlook'),
  phase: 'lazy',
  init: () => import('./behaviors/outlook.js'),
});

registerBehavior('calendly', {
  match: (a) => a.href.includes('calendly.com') || a.href.includes('/widgets/calendly'),
  phase: 'delayed',
  init: () => import('./behaviors/calendly.js'),
});
