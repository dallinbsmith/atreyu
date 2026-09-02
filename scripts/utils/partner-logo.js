import { sanitizeMarkup } from './security/sanitize.js';

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

// Fetches a partner/brand SVG by name from /img/partners/, inlines it
// (sanitized) into `target` rather than using <img>, so it can inherit
// currentColor and be sized via its own viewBox. Lives under img/, not
// icons/ — this is a name-keyed brand-logo lookup for two specific blocks
// (logo-wall, tile-table), not an author-typed `:iconname:` icon, so it
// doesn't belong in the icons/ convention that's reserved for that.
// Fails silently — a missing partner icon should never block the rest of
// the block from rendering. Returns the promise so a caller that needs to
// wait for real content (e.g. before cloneNode-ing a fully-populated node)
// can — existing fire-and-forget callers are unaffected either way.
export const loadPartnerLogo = (target, name, maxHeight = 24) => fetch(`/img/partners/${slugify(name)}.svg`)
  .then((r) => (r.ok ? r.text() : ''))
  .then((svg) => {
    if (!svg) return;
    target.replaceChildren(...sanitizeMarkup(svg).childNodes);
    const svgEl = target.querySelector('svg');
    const vb = svgEl?.getAttribute('viewBox')?.split(/\s+/).map(Number);
    if (vb?.length === 4) {
      const h = Math.min(vb[3], maxHeight);
      const w = vb[2] * (h / vb[3]);
      svgEl.style.width = `${Math.round(w)}px`;
      svgEl.style.height = `${Math.round(h)}px`;
    }
  })
  .catch(() => {});

// Shared "decorative icon + real accessible name" convention: the icon is
// aria-hidden (partner SVGs have no <title> of their own) and the name lives
// in a visually-hidden sibling — one place to build this pairing so blocks
// don't each reinvent it (see logo-wall.js, tile-table.js).
export const buildAccessibleLogo = (name, maxHeight = 24) => {
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'visually-hidden';
  label.textContent = name;
  return { icon, label, load: loadPartnerLogo(icon, name, maxHeight) };
};
