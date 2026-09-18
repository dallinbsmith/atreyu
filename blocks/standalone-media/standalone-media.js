// Full-width standalone media: a plain image, an autoplaying background-loop
// video (picture wrapped in an .mp4 link — decorateVideoMedia's established
// pattern), or a poster that opens a Wistia video in a modal on click
// (wireVideoModalLinks, same picture-wrapped-in-link authoring shape, just a
// different link host). Maps onto Falkor's real backgroundMedia vs
// playableVideo distinction using two already-established utilities, no new
// video logic. An optional "decoration: glassborder" metadata line (matching
// bentos.js's established convention) adds the shared glass-border treatment.
// Mobile alignment (left/right/center) is a variant; unset is full-width.
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { getCells, createElement, parseGlassborderDecoration } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  if (!guardDecorate(el, 'standaloneMedia')) return;

  parseGlassborderDecoration(el);

  // Classified by shape (F-66), not position: the decoration line lives in
  // its own row/cell, so a naive first-cell read can grab that now-emptied
  // cell instead of the real media cell depending purely on authoring order.
  const cell = getCells(el).find((c) => c.querySelector('picture'));
  const media = createElement('div', { className: 'standalone-media-media' }, ...(cell?.children ?? []));

  decorateVideoMedia(media);
  wireVideoModalLinks(media);

  el.replaceChildren(media);
};
