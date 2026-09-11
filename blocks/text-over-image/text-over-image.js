// Section banner: an eyebrow + large title set over a full-bleed media panel
// with a darkening overlay. Authored as one cell of text plus a media reference.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';

export default (el) => {
  // Media = whichever picture/video/img the author placed anywhere in the
  // cell. querySelector walks document order (parent-before-child), so a
  // <picture> is always found before its own inner <img>; the
  // .closest('picture') fallback only kicks in when EDS didn't wrap the ref.
  const source = el.querySelector('picture, video, img');
  if (source) {
    const node = source.closest('picture') ?? source;
    const host = node.closest('p') ?? node.parentElement;
    const media = createElement('div', { className: 'toi-media' }, node);
    // Full-bleed banner is decorative — the title carries meaning.
    media.querySelector('img')?.setAttribute('alt', '');
    el.prepend(media);
    // The <p> that authored the media ref is now empty — drop it so it
    // doesn't render as a stray blank line above the title.
    if (host && host !== el && !host.textContent.trim()) host.remove();
  }

  const content = el.querySelector(':scope > div:not(.toi-media)');
  if (content) {
    content.classList.add('toi-content');
    content.querySelector(HEADING_SELECTOR)?.classList.add('toi-title');
  }
  decorateRichText(el);
};
