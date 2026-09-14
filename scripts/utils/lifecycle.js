// Shared block-lifecycle primitives — see .claude/rules/scripts.md's
// "Block Lifecycle" section for the full rationale. Two separate problems,
// two separate primitives; most blocks only need the first one.

// Idempotency guard, replacing each block's own hand-rolled
// `if (el.dataset.xDecorated) return; el.dataset.xDecorated = 'true';`
// pattern with one consistently-named helper. `name` becomes the dataset
// key directly (e.g. guardDecorate(el, 'heroDecorated') sets/reads
// el.dataset.heroDecorated) — chosen to be a drop-in replacement for the
// existing per-block key names, not a new naming scheme. Returns `false`
// on a repeat call (caller should return early) or `true` on the first
// call (caller should proceed).
export const guardDecorate = (el, name) => {
  if (el.dataset[name]) return false;
  el.dataset[name] = 'true';
  return true;
};

// For the minority of blocks that hold live resources across their
// lifetime (listeners on a node other than el itself, Observers, rAF
// loops, timers) rather than just building static DOM once. Wraps a
// block's decorate function so whatever cleanup function it returns is
// structural, not optional: a later re-decoration of the exact same `el`
// runs the previous cleanup first, instead of leaking it the way a
// caller-discarded return value (e.g. rovingTabindex()'s cleanup handle)
// can. A decorate function that returns nothing/non-function is treated
// as having nothing to clean up — most blocks fall in this category and
// don't need this wrapper at all, guardDecorate() alone is enough.
const cleanups = new WeakMap();

export const withLifecycle = (decorate) => async (el, ...args) => {
  cleanups.get(el)?.();
  cleanups.delete(el);
  const cleanup = await decorate(el, ...args);
  if (typeof cleanup === 'function') cleanups.set(el, cleanup);
};
