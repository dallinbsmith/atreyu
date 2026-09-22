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
// duplicate on re-decoration. Tear them down with a module-scope
// AbortController aborted before recreate (see quote-hover.js); a per-el
// registry can't help, since the old element is discarded, not re-run.
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
