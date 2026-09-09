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

// Shared chevron glyph — same path already hand-duplicated as an inline
// string in blocks/quote-interactive/quote-modal.js's own `arrow()` helper;
// centralized here for any new caller (e.g. carousel.js) rather than
// re-copying it again. `fill="currentColor"` + a CSS `rotate(180deg)` on the
// consuming element is the established way to mirror it for a "previous"
// direction (see quote-interactive.css's `.qi-modal-arrow-prev`).
export const CHEVRON_SVG = '<svg viewBox="0 0 32.2 54.4" fill="currentColor"><path d="M30.8,23.6c2,2,2,5.1,0,7.1L8.6,52.9c-1.9,2-5.1,2-7.1,0c-2-1.9-2-5.1,0-7.1l18.7-18.7L1.5,8.5c-1.9-2-1.8-5.2,.1-7.1c1.9-1.9,5-1.9,6.9,0Z"/></svg>';
