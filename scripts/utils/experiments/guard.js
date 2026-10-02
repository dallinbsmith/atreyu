import { isVariantPath, toClassName } from './config.js';
import { isPluginKey } from './signals.js';

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

// Kept for Quick Edit and DA preview only: both run the loader on raw DA
// markup, where Section Metadata is still a table, so a plugin section swap
// would drop its Style/Anchor rows before loadArea() applies them. On
// .page/.live the server has already flattened Section Metadata, so there is
// nothing to carry and this does nothing.
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

export const stripPluginSectionMeta = (main = document.querySelector('main')) => {
  for (const meta of main?.querySelectorAll('.section-metadata') ?? []) {
    for (const row of [...meta.children]) {
      if (isPluginKey(toClassName(row.children[0]?.textContent))) row.remove();
    }
    if (!meta.children.length) meta.remove();
  }
};
