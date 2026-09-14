// Shared block-lifecycle primitive — see .claude/rules/scripts.md's
// "Block Lifecycle" section for the full rationale.

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
