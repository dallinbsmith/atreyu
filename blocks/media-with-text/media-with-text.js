// Mobile alignment and media/text order are authoring choices; classify by
// content shape so authors can reorder cells safely. Falkor's parallax is
// dead code in production; deliberately not ported.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import {
  createElement, getCells, HEADING_SELECTOR, parseGlassborderDecoration,
} from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el, { signal } = {}) => {
  if (signal?.aborted || !guardDecorate(el, 'mediaWithText')) return;

  parseGlassborderDecoration(el);

  // The media cell must be pure media; a text cell with an inline image/badge
  // would otherwise be taken as the media.
  const cells = getCells(el);
  const mediaCell = cells.find((c) => c.querySelector('picture, img') && !c.textContent.trim());
  const textCells = cells.filter((c) => c !== mediaCell);

  const text = createElement(
    'div',
    { className: 'media-with-text-text' },
    ...textCells.flatMap((c) => [...c.children]),
  );
  decorateRichText(text);
  text.querySelector(HEADING_SELECTOR)?.classList.add('media-with-text-heading');

  const media = createElement('div', { className: 'media-with-text-media' }, ...(mediaCell?.children ?? []));
  decorateVideoMedia(media);
  wireVideoModalLinks(media, { signal });

  el.replaceChildren(media, text);
};
