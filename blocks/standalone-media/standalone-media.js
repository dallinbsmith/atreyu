// Full-width media may include an optional decoration line. Classify by
// content shape so authors can reorder cells without changing behavior.
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { getCells, createElement, parseGlassborderDecoration } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  if (!guardDecorate(el, 'standaloneMedia')) return;

  parseGlassborderDecoration(el);

  // Classify by shape, not position: the decoration line lives in plain text;
  // the media cell owns picture/video/link markup.
  const cell = getCells(el).find((c) => c.querySelector('picture'));
  const media = createElement('div', { className: 'standalone-media-media' }, ...(cell?.children ?? []));

  decorateVideoMedia(media);
  wireVideoModalLinks(media);

  el.replaceChildren(media);
};
