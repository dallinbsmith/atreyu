// module.heroTransitionV4 → the `glow-reveal` block (site/blocks/
// glow-reveal, renamed from `hero-transition-v4` per .claude/rules/
// blocks.md). Real shape confirmed on the ja-jp enterprise/agencies page:
// no `content` field at all, just `media.glow` + `media.media.image`. This
// module really is only ever a single image (matching glow-reveal.js's own
// header comment, "6 of 7 real instances add a glow behind it"), resolved
// via renderImage() (see transform/media.js). The `glow` field itself
// (a named shape key) has no DA-side equivalent, glow-reveal.js's CSS
// applies the glow treatment unconditionally per its own real content note,
// so there's nothing to carry over from it.
import { renderImage } from '../media.js';
import { row, cell, block } from '../dom-helpers.js';

export const transformGlowReveal = (module, { warnings = [] } = {}) => {
  const picture = renderImage(module.media?.media?.image, { warnings });
  if (!picture) {
    warnings.push(`module.heroTransitionV4 "${module._key}" has no resolvable image (its only real content). Emitted empty.`);
    return block('glow-reveal');
  }
  return block('glow-reveal', row(cell(picture)));
};
