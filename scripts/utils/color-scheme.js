// Light/dark scheme from a section's computed background colour. Shared by
// section-metadata (applies it once a Background: colour is set) and the
// header's scheme toggle (re-applies it to every section after a switch).

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
