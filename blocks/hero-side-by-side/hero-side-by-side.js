// Vanilla port of Falkor's HeroSideBySide module — a two-column hero
// (eyebrow/title/body/CTAs next to a video or image), verified against 2
// real instances in the live Sanity dataset (features/workflow-management,
// homepage). Reuses the same video-behind-poster-picture convention as
// hero.js/hero-screen.js (scripts/utils/media.js) and the same text/media
// two-column grid idiom as the body-content side-by-side block — kept as
// its own block per the no-nested-blocks rule, not a variant of either.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { createElement } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

export default (el) => {
  // Row meaning is classified by content shape, never by position: the
  // media row is whichever row (if any) holds a picture; every other row's
  // content is merged into the text block rather than dropped.
  const rows = [...el.querySelectorAll(':scope > div')];
  const mediaRow = rows.find((r) => r.querySelector('picture'));
  const contentRows = rows.filter((r) => r !== mediaRow);

  const content = createElement('div', { className: 'hero-side-by-side-content' });
  contentRows.forEach((row) => content.append(...row.children));
  wireVideoModalLinks(content);
  const hasText = content.querySelector('h1, h2, h3, h4, h5, h6, p');

  el.replaceChildren();
  if (hasText) el.append(content); // DOM order text→media for a11y; CSS flips visually
  else el.classList.add('no-text');

  if (mediaRow) {
    const media = createElement('div', { className: 'hero-side-by-side-media' });
    media.append(...mediaRow.children);
    decorateVideoMedia(media);
    el.append(media);
  } else {
    el.classList.add('no-media');
  }
  decorateRichText(el);
};
