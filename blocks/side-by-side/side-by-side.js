import { decorateRichText } from '../../scripts/utils/richtext.js';
import { decorateTout } from '../../scripts/utils/touts.js';
import { createElement } from '../../scripts/utils/dom.js';

// One authored block = ONE Frame.io `SideBySideItem`. Rows classified by
// content shape, never by index: media (picture/img), touts (UL first-cell), text (rest).

const cellOf = (row) => row.firstElementChild ?? row;

const retag = (h, tag, attrs) => h.replaceWith(createElement(tag, attrs, ...h.childNodes));

// Force valid heading outline: first → <h2>, rest → <h3.side-by-side-subhead>.
const normalizeHeadings = (scope) => {
  const [primary, ...rest] = scope.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (!primary) return;
  if (primary.tagName !== 'H2') retag(primary, 'h2');
  rest.forEach((h) => retag(h, 'h3', { className: 'side-by-side-subhead' }));
};

const buildTouts = (list) => {
  const touts = [...list.children].map((li, idx) => {
    const tout = createElement('div', null, ...li.childNodes);
    decorateTout(tout, 'side-by-side-tout', `side-by-side-tout-${idx}`);
    return tout;
  });
  return createElement('div', {
    className: 'side-by-side-touts',
    style: `--tout-count: ${touts.length}`,
  }, ...touts);
};

const buildText = (rows) => {
  const body = createElement('div', { className: 'side-by-side-body' });
  for (const row of rows) body.append(...cellOf(row).children);
  decorateRichText(body); // must precede the .rt-eyebrow lookup below

  const eyebrow = body.querySelector('.rt-eyebrow')?.closest('p');
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  const title = createElement('div', { className: 'side-by-side-title' }, eyebrow, heading);

  const text = createElement('div', { className: 'side-by-side-text' }, title, body);
  normalizeHeadings(text);
  return text;
};

export default (el) => {
  if (el.dataset.sbs) return;
  el.dataset.sbs = 'true';

  const rows = [...el.children];
  const mediaRow = rows.find((r) => r.querySelector('picture, img'));
  const toutsRow = rows.find((r) => r !== mediaRow && cellOf(r).firstElementChild?.tagName === 'UL');
  const textRows = rows.filter((r) => r !== mediaRow && r !== toutsRow);

  el.replaceChildren();

  const text = buildText(textRows);
  if (toutsRow) text.append(buildTouts(cellOf(toutsRow).firstElementChild));
  const hasContent = text.querySelector('h1, h2, h3, h4, h5, h6, p, .side-by-side-touts');
  if (hasContent) el.append(text); // text→media DOM order for a11y; CSS flips visually
  else el.classList.add('no-text');

  if (!mediaRow) {
    el.classList.add('no-media');
    return;
  }

  const picture = mediaRow.querySelector('picture, img');
  const media = createElement('div', { className: 'side-by-side-media' }, picture);
  for (const img of media.querySelectorAll('img')) {
    if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  }
  el.append(media);
};
