// Vanilla port of Falkor's HeroScreen module — a centered hero (eyebrow/
// title/body/CTAs) with a glowing product "screen" (video or image) below
// it. Real content (checked directly against the live Sanity dataset,
// 2026-09-08) always uses this centered/stacked shape, not a side-by-side
// layout. Media authoring/decoration reuses the same picture-wrapped-in-
// mp4-link convention as hero.js (see scripts/utils/media.js) rather than
// inventing a second one; the glow treatment matches hero-transition-v4's.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { createElement, classifyCtaParagraphs, getCells } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

export default (el) => {
  // Idempotency guard — a second decorate() would re-find cells and re-wire
  // a second click listener onto the same still-present video link.
  if (el.dataset.heroScreenDecorated) return;
  el.dataset.heroScreenDecorated = 'true';

  // Cell, not row (`el.children` / getCells — not `:scope > div`). A picture
  // cell with a sibling text cell must not sweep that sibling into media.
  const cells = getCells(el);
  const picCell = cells.find((c) => c.querySelector('picture'));
  const extra = cells.filter((c) => c !== picCell);

  const content = createElement('div', { className: 'hero-screen-content' }, ...extra);
  classifyCtaParagraphs(content, 'hero-screen-cta');
  wireVideoModalLinks(content);

  const media = picCell && createElement(
    'div',
    { className: 'hero-screen-media' },
    ...picCell.children,
  );
  if (media) decorateVideoMedia(media);
  el.replaceChildren(content, ...(media ? [media] : []));
  decorateRichText(el);
};
