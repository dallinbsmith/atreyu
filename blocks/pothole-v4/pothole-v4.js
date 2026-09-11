// Pothole V4: same layout as pothole.js, plus a trailing `key: value`
// metadata row (`scale: n` → `--media-scale`, `glow: color` → `.glow-{color}`)
// and CSS variants (top/bottom/overflow/right-aligned).
import { decoratePothole } from '../../scripts/utils/pothole.js';

const GLOW_COLORS = new Set(['purple', 'blue', 'pink', 'green']);
const META_RE = /^(scale|glow)\s*:\s*(.+)$/i;

const apply = {
  scale: (el, value) => el.style.setProperty('--media-scale', value),
  glow: (el, value) => GLOW_COLORS.has(value) && el.classList.add(`glow-${value}`),
};

// Trailing single-cell `key: value` only — never a bare "1.2"/"purple", so
// real copy is not misread as metadata. Needs a background + content row
// left after removal, so a 1- or 2-row block is never treated as meta.
const applyMeta = (el) => {
  const last = el.lastElementChild;
  if (el.childElementCount < 3 || last.children.length !== 1) return;
  const [, key, value] = last.textContent.trim().match(META_RE) ?? [];
  if (!key) return;
  last.remove();
  apply[key.toLowerCase()]?.(el, value.trim().toLowerCase());
};

export default (el) => {
  if (el.dataset.potholeV4) return;
  el.dataset.potholeV4 = 'true';
  applyMeta(el);
  decoratePothole(el, { testidPrefix: 'pothole-v4' });
};
