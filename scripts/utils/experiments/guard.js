import { isVariantPath } from './config.js';

let activeGuard;

const requestUrl = (input) => new URL(input.url ?? input, window.location.href);
const requestMethod = (input, init) => init.method ?? input.method ?? 'GET';
const hasSignal = (input, init) => Boolean(init.signal ?? input.signal);

// Covers '/v/x', '/de-de/v/x' and the bare roots (config.js isVariantPath).
// Exported for tools/config-sync/locales.test.js, which checks it against the
// Worker's isVariantPage.
export const shouldGuard = (input, init = {}) => {
  const url = requestUrl(input);
  return url.origin === window.location.origin
    && isVariantPath(url.pathname)
    && requestMethod(input, init).toUpperCase() === 'GET'
    && !hasSignal(input, init);
};

const install = (ms) => {
  const guard = {
    realFetch: window.fetch,
    controllers: new Set(),
    expired: false,
    released: false,
    count: 0,
  };
  // Call the saved fetch with `this` = window: `guard.realFetch(...)` would
  // run native fetch with `this` = guard, which browsers reject ("Illegal
  // invocation"), failing every variant fetch. Unit tests stubbing fetch
  // with a plain function can't see that; the native-fetch test does.
  const callFetch = (...args) => guard.realFetch.apply(window, args);
  guard.wrapper = async (input, initArg) => {
    const init = initArg ?? {};
    if (guard.released || !shouldGuard(input, init)) return callFetch(input, init);
    const controller = new AbortController();
    guard.controllers.add(controller);
    if (guard.expired) controller.abort();
    return callFetch(input, { ...init, signal: controller.signal });
  };
  guard.deadline = setTimeout(() => {
    guard.expired = true;
    for (const controller of guard.controllers) controller.abort();
  }, ms);
  window.fetch = guard.wrapper;
  return guard;
};

const release = (guard) => {
  guard.count -= 1;
  if (guard.count) return;
  guard.released = true;
  clearTimeout(guard.deadline);
  guard.controllers.clear();
  if (window.fetch === guard.wrapper) window.fetch = guard.realFetch;
  if (activeGuard === guard) activeGuard = null;
};

export const withVariantTimeout = async (run, { ms = 1000 } = {}) => {
  activeGuard ??= install(ms);
  const guard = activeGuard;
  guard.count += 1;
  try {
    return await run();
  } finally {
    release(guard);
  }
};

const metadataRows = (section) => section.querySelector(':scope > .section-metadata');

const isCarryRow = (row) => ['style', 'anchor'].includes(row.children[0]?.textContent.trim().toLowerCase());

export const carryOverSectionMeta = (main = document.querySelector('main')) => {
  const sections = [...(main?.querySelectorAll(':scope > div') ?? [])];
  const stashed = new WeakMap();
  for (const section of sections) {
    const meta = metadataRows(section);
    const rows = [...(meta?.children ?? [])].filter(isCarryRow).map((row) => row.cloneNode(true));
    if (rows.length) stashed.set(section, { meta, rows });
  }
  return () => {
    for (const section of sections) {
      const saved = stashed.get(section);
      if (saved && !saved.meta.isConnected && !metadataRows(section)) {
        const meta = document.createElement('div');
        meta.className = 'section-metadata';
        meta.append(...saved.rows.map((row) => row.cloneNode(true)));
        section.append(meta);
      }
    }
  };
};

const hasAuthoredContent = (section) => [...section.children]
  .some((child) => !child.matches('.section-metadata'));

const CONFIG_BLOCKS = ['personalize', 'experiment'];

// Config tables are authoring input, never rendered blocks. Match on the
// first class only, so a rendered block with a `personalize` variant class
// is not mistaken for one.
export const findConfigBlocks = (root, names = CONFIG_BLOCKS) => [
  ...(root?.querySelectorAll(names.map((name) => `.${name}`).join(', ')) ?? []),
].filter((block) => names.includes(block.classList[0]));

// Removes one config table, and its section too when nothing but section
// metadata is left. Returns true when the section was removed. Shared by
// removeLeftoverConfigBlocks and the personalize compiler (personalize.js)
// so both apply the same "leave no empty section" rule.
export const removeConfigBlock = (block) => {
  const section = block.closest('main > div');
  block.remove();
  if (!section || hasAuthoredContent(section)) return false;
  section.remove();
  return true;
};

export const removeLeftoverConfigBlocks = (main = document.querySelector('main')) => {
  for (const block of findConfigBlocks(main)) removeConfigBlock(block);
};
