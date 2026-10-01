// Module-type dispatch table. Name-matched against
// locale-extraction-spike-2026-09-25.md's mapping table, with one real
// correction found while building this: that spike listed
// `block.calendlyButton` → the `hero-calendly` block (a whole block with its
// own embedded-scheduling-widget JS). Real data contradicts this, on the
// live ja-jp enterprise page, `block.calendlyButton` appears INSIDE
// module.heroScreen's own Portable Text content array as an inline CTA
// button (alongside `block.button`), not as a sibling entry in
// `sections[].modules[]`. It is handled as an inline button in
// portable-text.js, not as its own top-level module transformer. If a real
// page is ever found where `hero-calendly` (the standalone widget block) is
// actually the right target, that mapping still needs to be built from
// scratch, nothing here produces it.
import { transformHeroScreen } from './modules/hero-screen.js';
import { transformSpacer } from './modules/spacer.js';
import { transformLogoWall } from './modules/logo-wall.js';
import { transformStandaloneText } from './modules/standalone-text.js';
import { transformBookend } from './modules/bookend.js';
import { transformPothole } from './modules/pothole.js';
import { transformHero } from './modules/hero.js';
import { transformGlowReveal } from './modules/glow-reveal.js';
import { transformCardGridNav } from './modules/card-grid-nav.js';
import { transformFaq } from './modules/faq.js';
import { transformCarousel } from './modules/carousel.js';
import { transformBentos } from './modules/bentos.js';
import { transformSideBySides } from './modules/side-by-side.js';
import { transformTouts } from './modules/touts.js';
import {
  transformTextOverImage,
  transformStandoutMosaic,
} from './modules/stubs.js';

// `module.spacer` and `module.logoWall` return a bare element string, not a
// full `block(...)`-wrapped one (spacer has no rows; logo-wall's own
// `block()` call already does the wrapping), both are handled fine either
// way since `render.js` just concatenates whatever each transformer returns.
export const MODULE_TRANSFORMERS = {
  'module.heroScreen': transformHeroScreen,
  'module.spacer': transformSpacer,
  'module.logoWall': transformLogoWall,
  'module.standaloneText': transformStandaloneText,
  'module.bookEnd': transformBookend,
  'module.pothole': transformPothole,
  'module.potholeV4': transformPothole,
  'module.hero': transformHero,
  'module.heroTransitionV4': transformGlowReveal,
  'module.cardGridNav': transformCardGridNav,
  'module.faq': transformFaq,
  'module.carousel': transformCarousel,
  'module.bentos': transformBentos,
  'module.sideBySides': transformSideBySides,
  'module.textOverImage': transformTextOverImage,
  'module.touts': transformTouts,
  'module.standoutMosaic': transformStandoutMosaic,
};

// Never silently drop an unrecognized module type (same "fail loud over
// fabricating partial state" discipline as scripts.md's Global State
// section), an unknown type becomes a visible HTML comment in the output
// and a warning, not a missing section nobody notices until a real author
// complains content is gone.
export const transformModule = (module, ctx) => {
  const fn = MODULE_TRANSFORMERS[module._type];
  if (!fn) {
    ctx.warnings.push(`Unknown module type "${module._type}" (key: ${module._key}), no transformer registered, content dropped.`);
    return `<!-- UNHANDLED MODULE TYPE: ${module._type} (key: ${module._key}) -->`;
  }
  return fn(module, ctx);
};
