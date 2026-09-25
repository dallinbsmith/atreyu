// Shared block-lifecycle primitives — see .claude/rules/scripts.md's
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
// duplicate on re-decoration. Tie them to the `{ signal }` that ak.js passes
// as the block's second argument: `export default (el, { signal } = {}) => {}`.
// Pass it to addEventListener/fetch, and for timers, rAF and observers add
// `signal?.addEventListener('abort', cleanup)`. ak.js aborts it only after
// the block's element has left the document (Quick Edit, a plugin swap), so
// it never fires for a connected block. The abort happens at the next
// loadArea() sweep, which may never come, not at the moment the element is
// removed. A block can receive an already-aborted signal (its element was
// swapped out while its module loaded), and an 'abort' listener never fires
// on one: if `signal?.aborted`, return before starting timers, rAF or
// observers. Keep the `= {}` default: a direct
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
