import { toClassName } from '../../scripts/ak.js';

const toLinear = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

// WCAG relative luminance from sRGB — see w3.org/WAI/GL/wiki/Relative_luminance.
const luminance = ([r, g, b]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

// Pulls r/g/b from `rgb(...)` or `rgba(...)`. Alpha ignored for luminance;
// returns null for exotic serializations (oklch, color(...)) that the caller
// treats as "no scheme".
const parseColor = (section) => {
  const nums = getComputedStyle(section).backgroundColor.match(/\d+/g);
  return nums?.length >= 3 ? nums.slice(0, 3).map(Number) : null;
};

export const getColorScheme = (section) => {
  if (!section) return null;
  const rgb = parseColor(section);
  return rgb && (luminance(rgb) > 0.5 ? 'light-scheme' : 'dark-scheme');
};

export const setColorScheme = (section) => {
  const scheme = getColorScheme(section);
  if (!scheme) return;
  for (const el of section.children) {
    el.classList.remove('light-scheme', 'dark-scheme');
    el.classList.add(scheme);
  }
};

const applyMediaBackground = async (background, section) => {
  const url = new URL(background);
  if (/\.mp4$/i.test(url.pathname)) return;
  const { createPicture } = await import('../../scripts/utils/media/picture.js');
  const pic = createPicture({ src: url.href });
  pic.classList.add('section-background');
  section.classList.add('has-background');
  section.prepend(pic);
};

// The server keeps values as authored (`Color-Token-Accent`), so only the
// token check is case-insensitive; any other CSS color passes through as is.
const applyColorBackground = (background, section) => {
  const token = background.toLowerCase();
  section.style.backgroundColor = token.startsWith('color-token')
    ? `var(${token.replace('color-token', '--color')})`
    : background;
  setColorScheme(section);
};

// URLs keep their authored case: paths are case-sensitive.
const handleBackground = async (background, section) => {
  delete section.dataset.background;
  return /^https?:\/\//i.test(background)
    ? applyMediaBackground(background, section)
    : applyColorBackground(background, section);
};

// Authored values arrive as typed (`Bento`, `3 col`): classify them the way
// block variants are, so `.layout-bento` matches and a space can't throw.
const handleLayout = (value, section, type) => {
  delete section.dataset[type];
  const name = toClassName(value);
  if (!name || name === '0') return;
  if (type === 'grid') section.classList.add('grid');
  section.classList.add(`${type}-${name}`);
};

export default async (section) => {
  const {
    grid, gap, spacing, container, layout, background,
  } = section.dataset;
  if (grid) handleLayout(grid, section, 'grid');
  if (gap) handleLayout(gap, section, 'gap');
  if (spacing) handleLayout(spacing, section, 'spacing');
  if (container) handleLayout(container, section, 'container');
  if (background) await handleBackground(background, section);
  if (layout) handleLayout(layout, section, 'layout');
};
