// Loads a code-owned .svg file into a fresh SVG element. Markup lives in the
// file (block folder if one block owns it, img/glyphs/ if shared) — never as
// a JS string constant. Cache the fetch, parse per call so two consumers
// never share the same node. Prefer a CSS mask (`background-color` token
// + `mask: url(...)`) when the glyph is chrome and doesn't need path-level
// need path-level CSS or a GSAP target; this loader is for the remaining
// cases (e.g. youtube's two-tone play button).
import { parseSvg } from './dom.js';

const cache = new Map();

export const loadSvg = (url) => {
  if (!cache.has(url)) {
    const entry = fetch(url)
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (!text) cache.delete(url);
        return text;
      });
    cache.set(url, entry);
  }
  return cache.get(url).then((text) => (text ? parseSvg(text) : null));
};
