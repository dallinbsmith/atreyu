import { getConfig } from '../ak.js';

const { codeBase } = getConfig();
const cache = new Map();

const fetchIcon = (name) => {
  if (!cache.has(name)) {
    const entry = fetch(`${codeBase}/icons/${name}.svg`).then((r) => (r.ok ? r.text() : ''));
    // Only keep a failed/empty result cached long enough for concurrent callers to
    // share it — delete it once settled so a later use of the same icon retries
    // instead of staying permanently unupgraded for the rest of the session.
    entry.then((text) => { if (!text) cache.delete(name); });
    cache.set(name, entry);
  }
  return cache.get(name);
};

const upgradeIcon = async (icon) => {
  const name = icon.classList[1].substring(5);
  const text = await fetchIcon(name);
  if (!text || !icon.parentNode) return;
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('svg');
  if (!svg) return;
  svg.setAttribute('class', icon.className);
  svg.setAttribute('aria-hidden', 'true');
  icon.replaceWith(svg);
};

export default (icons) => Promise.all([...icons].map(upgradeIcon));
