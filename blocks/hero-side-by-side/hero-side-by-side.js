// Two-column hero reuses the shared video-behind-picture convention and
// side-by-side text/media DOM order; keep one responsive DOM.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import {
  createElement, classifyCtaParagraphs, getCells, HEADING_SELECTOR,
} from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  // Idempotency guard — a second decorate() call would otherwise re-find the
  // same cells and re-wire a second click listener onto the video link.
  if (!guardDecorate(el, 'heroSideBySideDecorated')) return;

  // Cell, not row: a picture cell with sibling text must not sweep the whole
  // row into the media slot.
  const cells = getCells(el);
  const picCell = cells.find((c) => c.querySelector('picture'));
  const extra = cells.filter((c) => c !== picCell);

  const content = createElement('div', { className: 'hero-side-by-side-content' }, ...extra);
  classifyCtaParagraphs(content, 'hero-side-by-side-cta');
  wireVideoModalLinks(content);
  const hasText = content.querySelector(`${HEADING_SELECTOR}, p`);
  const media = picCell && createElement(
    'div',
    { className: 'hero-side-by-side-media' },
    ...picCell.children,
  );
  if (media) decorateVideoMedia(media);
  else el.classList.add('no-media');
  if (!hasText) el.classList.add('no-text');

  // DOM order text→media for a11y; CSS flips visually.
  el.replaceChildren(...(hasText ? [content] : []), ...(media ? [media] : []));
  decorateRichText(el);
};
