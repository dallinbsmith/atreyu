import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { createElement } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

const decorateForeground = (fg) => {
  [...fg.children].forEach((child, idx) => {
    const heading = child.querySelector('h1, h2, h3, h4, h5, h6');
    const text = heading || child.querySelector('p, a, ul');
    if (heading) {
      heading.classList.add('hero-heading');
      heading.previousElementSibling?.classList.add('hero-detail');
    }
    if (text) {
      child.classList.add('fg-text');
      child.closest('.hero').classList.add(idx === 0 ? 'hero-text-start' : 'hero-text-end');
    }
  });
};

export default async (el) => {
  // Row meaning is classified by content shape, never by position/count: the
  // background row is whichever row (if any) holds a picture — not "whatever
  // is left after popping the last row" — so an unexpected extra row is
  // never silently misattributed as background or dropped as content.
  const rows = [...el.querySelectorAll(':scope > div')];
  const bgRow = rows.find((r) => r.querySelector('picture'));
  const contentRows = rows.filter((r) => r !== bgRow);

  const fg = createElement('div', { className: 'hero-foreground' });
  contentRows.forEach((row) => fg.append(...row.children));
  el.replaceChildren(fg);
  decorateForeground(fg);
  wireVideoModalLinks(fg);

  if (bgRow) {
    const bg = createElement('div', { className: 'hero-background' });
    bg.append(...bgRow.children);
    decorateVideoMedia(bg);
    el.prepend(bg);
  }
  decorateRichText(el);
};
