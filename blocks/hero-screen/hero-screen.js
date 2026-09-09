// Vanilla port of Falkor's HeroScreen module — a centered hero (eyebrow/
// title/body/CTAs) with a glowing product "screen" (video or image) below
// it. Real content (checked directly against the live Sanity dataset,
// 2026-09-08) always uses this centered/stacked shape, not a side-by-side
// layout. Media authoring/decoration reuses the same picture-wrapped-in-
// mp4-link convention as hero.js (see scripts/utils/media.js) rather than
// inventing a second one; the glow treatment matches hero-transition-v4's.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { createElement } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

export default (el) => {
  // Idempotency guard — checked before any DOM restructuring below. A second
  // decorate() call would otherwise re-find the same cells (rows sit at the
  // same `:scope > div` depth as originally authored) and re-wire a second
  // click listener onto the same still-present video link.
  if (el.dataset.heroScreenDecorated) return;
  el.dataset.heroScreenDecorated = 'true';

  // Row meaning is classified by content shape, never by position: the
  // media row is whichever row (if any) holds a picture; every other row's
  // content is merged into the centered text block rather than dropped.
  const rows = [...el.querySelectorAll(':scope > div')];
  const mediaRow = rows.find((r) => r.querySelector('picture'));
  const contentRows = rows.filter((r) => r !== mediaRow);

  const content = createElement('div', { className: 'hero-screen-content' });
  contentRows.forEach((row) => content.append(...row.children));
  el.replaceChildren(content);
  wireVideoModalLinks(content);

  if (mediaRow) {
    const media = createElement('div', { className: 'hero-screen-media' });
    media.append(...mediaRow.children);
    decorateVideoMedia(media);
    el.append(media);
  }
  decorateRichText(el);
};
