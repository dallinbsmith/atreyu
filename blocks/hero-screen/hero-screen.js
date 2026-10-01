// Centered hero keeps text first, then the product screen below the content;
// optional video is decorated with the shared video-behind-picture helper.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { createElement, classifyCtaParagraphs, getCells } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  // Idempotency guard — a second decorate() would re-find cells and re-wire
  // a second click listener onto the same still-present video link.
  if (!guardDecorate(el, 'heroScreenDecorated')) return;

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
