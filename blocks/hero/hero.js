import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { openVideoModal, WISTIA_RE } from '../../scripts/utils/modal/video-modal.js';
import { createElement } from '../../scripts/utils/dom.js';

const setBackgroundFocus = (img) => {
  const { title } = img.dataset;
  if (!title?.includes('data-focal')) return;
  delete img.dataset.title;
  const [x, y] = title.split(':')[1].split(',');
  img.style.objectPosition = `${x}% ${y}%`;
};

const decorateBackground = (bg) => {
  const bgPic = bg.querySelector('picture');
  if (!bgPic) return;

  const img = bgPic.querySelector('img');
  setBackgroundFocus(img);

  const vidLink = bgPic.closest('a[href*=".mp4"]');
  if (!vidLink) return;
  if (!shouldAnimate()) {
    vidLink.remove();
    return;
  }
  const video = document.createElement('video');
  video.src = vidLink.href;
  video.loop = true;
  video.muted = true;
  video.inert = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'none');
  video.load();
  video.addEventListener('canplay', () => {
    video.play();
    bgPic.remove();
  });
  vidLink.parentElement.append(video, bgPic);
  vidLink.remove();
};

const decorateVideoModalCta = (fg) => {
  const link = [...fg.querySelectorAll('a')].find((a) => WISTIA_RE.test(a.href));
  if (!link) return;
  const [, id] = link.href.match(WISTIA_RE);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openVideoModal(id, link.textContent.trim(), link);
  });
};

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
  decorateVideoModalCta(fg);

  if (bgRow) {
    const bg = createElement('div', { className: 'hero-background' });
    bg.append(...bgRow.children);
    decorateBackground(bg);
    el.prepend(bg);
  }
  decorateRichText(el);
};
