// Section banner: an eyebrow + large title set over a full-bleed media panel
// with a darkening overlay. Authored as one cell of text plus a media reference.
import { decorateRichText } from '../../scripts/utils/richtext.js';

export default (el) => {
  const pic = el.querySelector('picture, img, video');
  if (pic) {
    const media = document.createElement('div');
    media.className = 'toi-media';
    const host = pic.closest('p') ?? pic.parentElement;
    media.append(pic.closest('picture') ?? pic);
    el.prepend(media);
    if (host && host !== el && !host.textContent.trim()) host.remove();
  }

  const content = el.querySelector(':scope > div:not(.toi-media)');
  content?.classList.add('toi-content');
  el.querySelector('h1, h2, h3, h4, h5, h6')?.classList.add('toi-title');
  decorateRichText(el);
};
