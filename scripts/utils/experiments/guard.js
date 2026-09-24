import { VARIANT_ROOT } from './config.js';

let wrappedFetch;
let activeGuards = 0;
let activeDeadline;
let activeControllers;
let activeExpired = false;
let activeRealFetch;

const requestUrl = (input) => new URL(input.url ?? input, window.location.href);
const requestMethod = (input, init) => init.method ?? input.method ?? 'GET';
const hasSignal = (input, init) => Boolean(init.signal ?? input.signal);

const shouldGuard = (input, init = {}) => {
  const url = requestUrl(input);
  return url.origin === window.location.origin
    && url.pathname.startsWith(VARIANT_ROOT)
    && requestMethod(input, init).toUpperCase() === 'GET'
    && !hasSignal(input, init);
};

export const withVariantTimeout = async (run, { ms = 1000 } = {}) => {
  const release = (wrapper) => {
    activeGuards -= 1;
    if (activeGuards) return;
    clearTimeout(activeDeadline);
    activeControllers.clear();
    if (window.fetch === wrapper) window.fetch = activeRealFetch;
    if (wrappedFetch === wrapper) wrappedFetch = null;
    activeDeadline = null;
    activeControllers = null;
    activeExpired = false;
    activeRealFetch = null;
  };
  if (window.fetch !== wrappedFetch) {
    activeRealFetch = window.fetch;
    activeControllers = new Set();
    activeExpired = false;
    const wrapper = async (input, initArg) => {
      const init = initArg ?? {};
      if (!shouldGuard(input, init)) return activeRealFetch(input, init);
      const controller = new AbortController();
      activeControllers.add(controller);
      if (activeExpired) controller.abort();
      return activeRealFetch(input, { ...init, signal: controller.signal });
    };
    activeDeadline = setTimeout(() => {
      activeExpired = true;
      for (const controller of activeControllers) controller.abort();
    }, ms);
    wrappedFetch = wrapper;
    window.fetch = wrapper;
  }
  const wrapper = wrappedFetch;
  activeGuards += 1;
  try {
    return await run();
  } finally {
    release(wrapper);
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

export const removeLeftoverConfigBlocks = (main = document.querySelector('main')) => {
  for (const block of [...(main?.querySelectorAll('.personalize, .experiment') ?? [])]) {
    if (['personalize', 'experiment'].includes(block.classList[0])) {
      const section = block.closest('main > div');
      block.remove();
      if (section && !hasAuthoredContent(section)) section.remove();
    }
  }
};
