// Video playlist: a large "featured" poster-card (the first authored item)
// followed by a list of the remaining items — each item is a poster + title +
// subtitle that opens its own Wistia video in the shared accessible modal on
// click. Mirrors Falkor's VideoPlaylist (featured + list); the collapse toggle
// is deliberately omitted — the resting, all-visible DOM is the accessible
// baseline, not a fallback, so there is no motion to gate. Reuses WISTIA_RE +
// openVideoModal (no new video logic) and gives every interactive item a
// per-instance-UNIQUE data-testid drawn from its flat position (bentos.js's
// indexing contract — indices never reset per row). Items authored without a
// Wistia link render as static cards, never a dead play button.
import { openVideoModal, WISTIA_RE } from '../../scripts/utils/modal/video-modal.js';
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

const textOf = (cell) => cell?.textContent.trim() ?? '';

// Classify one authored row by content SHAPE, not column position: the cell
// holding a picture is the poster, any Wistia link supplies the video id, and
// the remaining non-empty text cells are title (heading first, else first
// text) then subtitle.
const readItem = (row) => {
  const cells = [...row.children];
  const posterCell = cells.find((c) => c.querySelector('picture, img'));
  const link = [...row.querySelectorAll('a')].find((a) => WISTIA_RE.test(a.href));
  const linkCell = cells.find((c) => link && c.contains(link));
  const textCells = cells.filter((c) => c !== posterCell && c !== linkCell && textOf(c));
  const titleCell = textCells.find((c) => c.querySelector(HEADING_SELECTOR)) ?? textCells[0];
  return {
    poster: posterCell?.querySelector('picture, img') ?? null,
    wistiaId: link ? link.href.match(WISTIA_RE)[1] : null,
    title: textOf(titleCell),
    subtitle: textOf(textCells.find((c) => c !== titleCell)),
  };
};

const playControl = (playLabel) => createElement(
  'span',
  { className: 'video-playlist-play' },
  createElement('span', { className: 'visually-hidden' }, playLabel),
);

const buildCard = (item, index, featured, playLabel) => {
  const variant = featured ? 'video-playlist-featured' : 'video-playlist-thumb';
  const testid = `video-playlist-item-${index}`;
  const info = createElement(
    'span',
    { className: 'video-playlist-info' },
    item.title && createElement('span', { className: 'video-playlist-title' }, item.title),
    item.subtitle && createElement('span', { className: 'video-playlist-subtitle' }, item.subtitle),
  );

  // The play affordance and (for the featured card) the overlaid label live
  // INSIDE the relative poster, so their absolute positioning resolves against
  // the poster box rather than escaping to the viewport. A thumb sets its label
  // beside the poster instead. No Wistia link → no play control (never a dead,
  // clickable-looking control that does nothing).
  const poster = createElement(
    'span',
    { className: 'video-playlist-poster' },
    item.poster,
    item.wistiaId && playControl(playLabel),
    featured ? info : null,
  );
  const cardKids = featured ? [poster] : [poster, info];

  if (!item.wistiaId) {
    return createElement('div', { className: `${variant} is-static`, 'data-testid': testid }, ...cardKids);
  }

  const btn = createElement('button', { type: 'button', className: variant, 'data-testid': testid }, ...cardKids);
  btn.addEventListener('click', () => openVideoModal(item.wistiaId, item.title || playLabel, btn));
  return btn;
};

export default async (el) => {
  if (!guardDecorate(el, 'videoPlaylist')) return;

  const items = [...el.children].map(readItem).filter((it) => it.poster || it.title);
  if (!items.length) {
    el.replaceChildren();
    return;
  }

  // English fallback; getPlaceholder fails open to it when the JSON 404s.
  const playLabel = await getPlaceholder('videoplaylistplay', 'Watch the Video');

  const cards = items.map(
    (item, i) => buildCard(item, i, i === 0, playLabel),
  );
  const list = createElement(
    'ul',
    { className: 'video-playlist-list' },
    ...cards.slice(1).map((card) => createElement('li', { className: 'video-playlist-item' }, card)),
  );

  el.replaceChildren(cards[0], list);
};
