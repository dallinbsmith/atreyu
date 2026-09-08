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

// Parses an SVG markup string into a real element — same DOMParser approach
// already used for author-supplied SVGs in icons.js/partner-logo.js. Lets a
// caller avoid `el.innerHTML = markup` entirely (no-unsanitized/property
// flags that regardless of whether `markup` is a fixed constant or not) by
// building real nodes and appending them instead.
export const parseSvg = (markup) => new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('svg');
