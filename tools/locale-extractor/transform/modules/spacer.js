// module.spacer → the `spacer` block (site/blocks/spacer). Real shape
// confirmed on the ja-jp enterprise page: `sizes: [{breakpoint, height}]`,
// one entry per breakpoint (sm/md/lg), height in px, not a size keyword.
// atreyu's spacer only has 5 discrete keyword variants (spacer.css), so this
// maps the module's `sm`-breakpoint height to the nearest keyword's own
// mobile/base height. This is an approximation, not an exact round-trip.
// A page author who picked e.g. a 96px spacer gets whichever keyword is
// closest, not a pixel-perfect match. Flagged with a warning whenever the
// nearest match isn't exact, so a human can sanity-check real cases later.
const BASE_HEIGHTS = { s: 32, m: 64, l: 88, xl: 120, xxl: 160 };

const nearestSize = (px) => Object.entries(BASE_HEIGHTS)
  .reduce((best, [name, h]) => (Math.abs(h - px) < Math.abs(BASE_HEIGHTS[best] - px) ? name : best), 's');

export const transformSpacer = (module, { warnings = [] } = {}) => {
  const sm = module.sizes?.find((s) => s.breakpoint === 'sm')?.height;
  if (sm == null) {
    warnings.push(`module.spacer "${module._key}" has no sm-breakpoint height, defaulting to "m".`);
    return '<div class="spacer m"></div>';
  }
  const size = nearestSize(sm);
  if (BASE_HEIGHTS[size] !== sm) {
    warnings.push(`module.spacer "${module._key}": sm height ${sm}px has no exact keyword match, used nearest ("${size}" = ${BASE_HEIGHTS[size]}px).`);
  }
  return `<div class="spacer ${size}"></div>`;
};
