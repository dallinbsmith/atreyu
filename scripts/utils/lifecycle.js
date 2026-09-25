// Shared block-lifecycle primitives — see .claude/rules/scripts.md's
// "Block Lifecycle" section for the full rationale.

import ENV from './env.js';

// Idempotency guard, replacing each block's own hand-rolled
// `if (el.dataset.xDecorated) return; el.dataset.xDecorated = 'true';`
// pattern with one consistently-named helper. `name` becomes the dataset
// key directly (e.g. guardDecorate(el, 'heroDecorated') sets/reads
// el.dataset.heroDecorated) — chosen to be a drop-in replacement for the
// existing per-block key names, not a new naming scheme. Returns `false`
// on a repeat call (caller should return early) or `true` on the first
// call (caller should proceed).
//
// For blocks holding resources OUTSIDE their own subtree (a document.body-
// appended node, a window/document listener, an Observer/timer/rAF loop),
// this guard is not enough — those survive a DA Quick Edit DOM swap and
// duplicate on re-decoration. Tie them to the `{ signal }` that ak.js passes
// as the block's second argument: `export default (el, { signal } = {}) => {}`.
// Pass it to addEventListener/fetch, and for timers, rAF and observers add
// `signal?.addEventListener('abort', cleanup)`. ak.js aborts it only after
// the block's element has left the document (Quick Edit, a plugin swap), so
// it never fires for a connected block. Keep the `= {}` default: a direct
// call (tests) passes no second argument, leaving `signal` undefined, which
// addEventListener accepts. Keep this guard too: the signal does not stop a
// direct second call. The signal belongs to the element passed in: a block
// that replaces that element (youtube.js's `a.replaceWith(container)`) has
// its signal aborted on the next sweep while the new content is still live,
// so only use it for resources tied to content that stays in the tree.
export const guardDecorate = (el, name) => {
  if (el.dataset[name]) return false;
  el.dataset[name] = 'true';
  return true;
};

// Third Block Lifecycle primitive — "external targeted content replacement."
// A chrome-scoped experiment swap (experimentation.js's applyChallenger, UC-02:
// nav/footer/floating elements) does a raw target.replaceChildren(...) with no
// redecoration step of its own — it doesn't know how to rebuild whatever
// block-specific structure (nav classes, mega-menu wiring, footer section
// classification) the swapped-in content needs. That knowledge belongs to the
// block that owns the selector, not to experimentation.js. This registry lets
// a block register its own redecorator once, at module scope (before any late-
// phase experiment can run), and lets the swap call it back by the exact same
// selector string an author put in `experiment-selector` metadata — without
// experimentation.js importing block code directly (blocks -> utils, never
// the reverse, per scripts.md's Shared Utilities rule).
const redecorators = new Map();

export const registerRedecorator = (selector, fn) => {
  redecorators.set(selector, fn);
};

// Fails open, matching every other missing-target path in experimentation.js:
// an unregistered selector is a real authoring/config mismatch (an author
// pointed `experiment-selector` at something no block redecorates), not a
// crash — warn in dev so it's visible during authoring, but never break the
// swap itself in production.
export const redecorate = async (selector, target) => {
  const fn = redecorators.get(selector);
  if (!fn) {
    // eslint-disable-next-line no-console -- this warning IS the diagnostic (dev-only)
    if (ENV !== 'prod') console.warn(`lifecycle.js: no redecorator registered for "${selector}" — swapped content will not be redecorated.`);
    return;
  }
  await fn(target);
};
