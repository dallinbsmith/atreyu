import { getConfig } from '../ak.js';

const { codeBase } = getConfig();
const cache = new Map();

const fetchIcon = (name) => {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${codeBase}/icons/${name}.svg`).then((r) => (r.ok ? r.text() : '')));
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
