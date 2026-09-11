// Design breakpoints — one source of truth for JS. The numeric BP_* values
// are canonical; the MQ_* media-query strings are derived from them so a
// change to the number automatically propagates.
//
// CSS files still hardcode the same pixel values (styles/styles.css and every
// block's own .css) because the CSS-side centralizer, @custom-media, is not
// yet production-viable: as of 2026-09, per web-platform-dx, Chrome, Edge,
// Firefox, and Safari all list it as "Not supported" (Firefox 148 has it
// behind `layout.css.custom-media.enabled`, off by default). CSS custom
// properties can't help either — they can't appear inside media query
// conditions. So CSS keeps hardcoded pixels that MUST match these numbers
// (768 md, 1240 lg, 1440 grid cap). This module owns the JS side.
export const BP_MD = 768;
export const BP_LG = 1240;
export const BP_GRID_CAP = 1440;

export const MQ_MD = `(width >= ${BP_MD}px)`;
export const MQ_LG = `(width >= ${BP_LG}px)`;
export const MQ_GRID_CAP = `(width >= ${BP_GRID_CAP}px)`;
