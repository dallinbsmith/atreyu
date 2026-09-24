import { VARIANT_ROOT } from './config.js';

let wrappedFetch;

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
  if (window.fetch === wrappedFetch) return run();
  const realFetch = window.fetch;
  const controllers = new Set();
  let expired = false;
  const restore = () => {
    if (window.fetch === wrappedFetch) window.fetch = realFetch;
    wrappedFetch = null;
  };
  const abortAll = () => {
    expired = true;
    for (const controller of controllers) controller.abort();
    restore();
  };
  const deadline = setTimeout(abortAll, ms);
  wrappedFetch = async (input, initArg) => {
    const init = initArg ?? {};
    if (!shouldGuard(input, init)) return realFetch(input, init);
    const controller = new AbortController();
    controllers.add(controller);
    if (expired) controller.abort();
    return realFetch(input, { ...init, signal: controller.signal });
  };
  window.fetch = wrappedFetch;
  try {
    return await run();
  } finally {
    clearTimeout(deadline);
    controllers.clear();
    restore();
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

const hasVisibleContent = (section) => section.textContent.trim()
  || section.querySelector('img,picture,video,svg,iframe,canvas,input,button,a');

export const removeLeftoverConfigBlocks = (main = document.querySelector('main')) => {
  for (const block of [...(main?.querySelectorAll('.personalize, .experiment') ?? [])]) {
    if (['personalize', 'experiment'].includes(block.classList[0])) {
      const section = block.closest('main > div');
      block.remove();
      if (section && !hasVisibleContent(section)) section.remove();
    }
  }
};
