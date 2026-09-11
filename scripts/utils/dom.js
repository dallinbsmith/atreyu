// Zero-dependency hyperscript-style DOM builder — real precedent at World
// Bank (aemsites/world-bank/scripts/dom-helpers.js) and CME Group
// (aemedge/scripts/utils.js), not a pattern invented for this project.
// Cuts createElement/className/append ceremony when a block builds a new
// wrapper element. It does not replace, and cannot substitute for, the
// separate discipline of classifying authored rows by content shape rather
// than position — see .claude/rules/blocks.md.
export const createElement = (tag, attrs, ...children) => {
  const el = document.createElement(tag);
  Object.entries(attrs ?? {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'className') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else el.setAttribute(key, value === true ? '' : value);
  });
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
};

// Parses an SVG markup string into a real element. Deliberately parses as
// 'text/html', not 'image/svg+xml': confirmed live (2026-09-09) that
// DOMParser's XML mode only assigns the SVG element the correct
// http://www.w3.org/2000/svg namespace when the markup itself carries an
// explicit xmlns attribute — real standalone .svg files always have one
// (icons.js fetches real files directly, unaffected; partner-logo.js goes
// through sanitizeMarkup(), which already parses as 'text/html'), but a
// hand-written inline SVG string constant (the actual use case here) never
// does. Without the right namespace the element doesn't render as SVG at all
// (no intrinsic sizing, presentation attributes like fill="currentColor" do
// nothing) — a real, silent-failure regression this rule found in
// tile-modal.js/youtube.js before this fix. HTML parsing assigns the correct
// namespace either way, no xmlns required, since foreign-content (svg/math)
// handling is baked into the HTML parsing algorithm itself.
export const parseSvg = (markup) => new DOMParser().parseFromString(markup, 'text/html').querySelector('svg');

// A block's row/cell shape is fixed by the platform's own document model
// (blocks.md's Init Contract: children of `el` are rows, children of rows
// are cells) — this just flattens that two-level structure into one array
// of every cell, for blocks that classify a specific cell (e.g. "whichever
// cell holds a picture") rather than a whole row. Real DOM traversal
// (`.children`), not a `:scope > div > div` selector string, so a typo
// can't silently return an empty list.
export const getCells = (el) => [...el.children].flatMap((row) => [...row.children]);

// Classify by content shape, never a structural selector (scripts.md's
// "Identifying Elements" rule): every paragraph that contains a link gets
// className, so CSS keys off the class instead of re-deriving "which
// paragraph is the CTA" via `p:has(a)`. Shared by hero-screen.js,
// hero-side-by-side.js, and rich-text.js — all three had this exact 3-line
// classifier duplicated verbatim before being extracted here.
export const classifyCtaParagraphs = (scope, className) => {
  [...scope.querySelectorAll('p')]
    .filter((p) => p.querySelector('a'))
    .forEach((p) => p.classList.add(className));
};

// The "any HTML heading" selector, named once. HTML5 has no `<h>` element,
// so the six-tag list is the shortest native form — but every block that
// asks for "the heading" was spelling it out inline (8 duplicated sites at
// extraction time, across blocks and scripts/utils/touts.js), so the
// literal string moves here and callers reference the constant instead.
export const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

// Shared chevron glyph — same path already hand-duplicated as an inline
// string in blocks/quote-interactive/quote-modal.js's own `arrow()` helper;
// centralized here for any new caller (e.g. carousel.js) rather than
// re-copying it again. `fill="currentColor"` + a CSS `rotate(180deg)` on the
// consuming element is the established way to mirror it for a "previous"
// direction (see quote-interactive.css's `.qi-modal-arrow-prev`).
export const CHEVRON_SVG = '<svg viewBox="0 0 32.2 54.4" fill="currentColor"><path d="M30.8,23.6c2,2,2,5.1,0,7.1L8.6,52.9c-1.9,2-5.1,2-7.1,0c-2-1.9-2-5.1,0-7.1l18.7-18.7L1.5,8.5c-1.9-2-1.8-5.2,.1-7.1c1.9-1.9,5-1.9,6.9,0Z"/></svg>';

// Compact stroke-style chevron for small nav buttons (12×12) — visually
// distinct from CHEVRON_SVG's filled portrait glyph. Consuming element
// rotates 180deg for a "previous" arrow (see tile-table.css `.tt-modal-prev`).
export const CHEVRON_LINE_SVG = '<svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Close (X) glyph for modal/dialog close buttons — 12×12 stroke, currentColor.
export const CLOSE_SVG = '<svg viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

// Plus (+) glyph — 24×24 stroke, currentColor. Distinct from CLOSE_SVG:
// this is a `+` that consumers may either use as-is (add/expand affordances)
// or animate a 45° rotation on to morph it into an `×` (see
// quote-interactive's modal open timeline, which rotates the child SVG).
export const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

// YouTube-styled play button — 68×48. Unlike the other SVGs here, paths
// carry `class="youtube-play-bg"` and `class="youtube-play-icon"` hooks
// (not `currentColor`); consumer CSS must style them (see youtube.css).
export const PLAY_SVG = '<svg viewBox="0 0 68 48" aria-hidden="true"><path class="youtube-play-bg" d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"/><path class="youtube-play-icon" d="M45 24 27 14v20z"/></svg>';
