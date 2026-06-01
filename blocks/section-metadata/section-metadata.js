const parseColor = (section) => {
  if (!section) return null;

  const computedBg = getComputedStyle(section).backgroundColor;
  const rgbMatch = computedBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!rgbMatch) return null;
  return {
    r: parseInt(rgbMatch[1], 10),
    g: parseInt(rgbMatch[2], 10),
    b: parseInt(rgbMatch[3], 10),
  };
};

const getRelativeLuminance = ({ r, g, b }) => {
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : ((rsRGB + 0.055) / 1.055) ** 2.4;
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : ((gsRGB + 0.055) / 1.055) ** 2.4;
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : ((bsRGB + 0.055) / 1.055) ** 2.4;

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

export const getColorScheme = (section) => {
  const rgb = parseColor(section);
  if (!rgb) return null;

  return getRelativeLuminance(rgb) > 0.5 ? 'light-scheme' : 'dark-scheme';
};

export const setColorScheme = (section) => {
  const scheme = getColorScheme(section);
  if (!scheme) return;
  for (const el of section.querySelectorAll(':scope > *')) {
    el.classList.remove('light-scheme', 'dark-scheme');
    el.classList.add(scheme);
  }
};

const handleBackground = async (background, section) => {
  delete section.dataset.background;

  const isMedia = background.startsWith('http');
  if (isMedia) {
    const mediaUrl = new URL(background, window.location.href);
    if (mediaUrl.pathname.endsWith('.mp4')) return;
    const { createPicture } = await import('../../scripts/utils/picture.js');
    const pic = createPicture({ src: mediaUrl.href });
    section.classList.add('has-background');
    pic.classList.add('section-background');
    section.prepend(pic);
    return;
  }

  section.style.backgroundColor = background.startsWith('color-token')
    ? `var(${background.replace('color-token', '--color')})`
    : background;

  setColorScheme(section);
};

const handleLayout = async (text, section, type) => {
  delete section.dataset[type];

  if (text === '0') return;
  if (type === 'grid') section.classList.add('grid');
  section.classList.add(`${type}-${text}`);
};

export default async (section) => {
  const {
    grid,
    gap,
    spacing,
    container,
    layout,
    background,
  } = section.dataset;
  if (grid) handleLayout(grid, section, 'grid');
  if (gap) handleLayout(gap, section, 'gap');
  if (spacing) handleLayout(spacing, section, 'spacing');
  if (container) handleLayout(container, section, 'container');
  if (background) await handleBackground(background, section);
  if (layout) handleLayout(layout, section, 'layout');
};
