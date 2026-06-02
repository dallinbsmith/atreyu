import { decorateRichText } from '../../scripts/utils/richtext.js';
import { decorateTout } from '../../scripts/utils/touts.js';

// One authored block instance = ONE Frame.io `SideBySideItem`.
// Rows are detected by content shape, never by index:
//   media row  = first row containing an img/picture
//   touts row  = a row whose cell holds a <ul> (each <li> is a tout)
//   text rows  = everything else (eyebrow / heading / subheads / body / links)

const cellOf = (row) => row.querySelector(':scope > div') ?? row;

const normalizeHeadings = (scope) => {
  const headings = [...scope.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  if (!headings.length) return;
  const [primary, ...rest] = headings;
  if (primary.tagName !== 'H2') {
    const h2 = document.createElement('h2');
    h2.append(...primary.childNodes);
    primary.replaceWith(h2);
  }
  // keep a valid, non-skipping outline: demote remaining headings to <h3>,
  // preserving visual scale via a class rather than an invalid level.
  rest.forEach((h) => {
    const h3 = document.createElement('h3');
    h3.className = 'side-by-side-subhead';
    h3.append(...h.childNodes);
    h.replaceWith(h3);
  });
};

const buildTouts = (cell) => {
  const list = cell.querySelector(':scope > ul');
  const items = [...list.children];
  const touts = document.createElement('div');
  touts.className = 'side-by-side-touts';
  touts.style = `--tout-count: ${items.length}`;
  items.forEach((li) => {
    const tout = document.createElement('div');
    tout.append(...li.childNodes);
    decorateTout(tout, 'side-by-side-tout');
    touts.append(tout);
  });
  return touts;
};

const buildText = (rows) => {
  const text = document.createElement('div');
  text.className = 'side-by-side-text';
  const title = document.createElement('div');
  title.className = 'side-by-side-title';
  const body = document.createElement('div');
  body.className = 'side-by-side-body';

  // Collect every text-row cell child, decorate inline styles first so the
  // eyebrow span exists, then partition: eyebrow + first heading → title.
  rows.forEach((row) => body.append(...cellOf(row).children));
  decorateRichText(body);

  // eyebrow is authored on its own line ([[eyebrow|…]]); move its paragraph
  const eyebrow = body.querySelector('.rt-eyebrow')?.closest('p');
  if (eyebrow) title.append(eyebrow);
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) title.append(heading);

  text.append(title, body);
  normalizeHeadings(text); // one h2 across the whole region; rest → h3 subheads
  return text;
};

export default (el) => {
  if (el.dataset.sbs) return;
  el.dataset.sbs = 'true';

  const rows = [...el.children];
  const mediaRow = rows.find((r) => r.querySelector(':scope img, :scope picture'));
  const toutsRow = rows.find((r) => r !== mediaRow && cellOf(r).querySelector(':scope > ul'));
  const textRows = rows.filter((r) => r !== mediaRow && r !== toutsRow);

  el.replaceChildren();

  const text = buildText(textRows);
  if (toutsRow) text.append(buildTouts(cellOf(toutsRow)));
  if (!text.querySelector('h1, h2, h3, h4, h5, h6, p, .side-by-side-touts')) {
    el.classList.add('no-text');
  } else {
    el.append(text); // DOM order text→media for a11y; CSS flips visually
  }

  if (mediaRow) {
    const media = document.createElement('div');
    media.className = 'side-by-side-media';
    media.append(mediaRow.querySelector('picture') ?? mediaRow.querySelector('img'));
    [...media.querySelectorAll('img')].forEach((img) => {
      img.setAttribute('loading', img.getAttribute('loading') ?? 'lazy');
      img.setAttribute('decoding', 'async');
    });
    el.append(media);
  } else {
    el.classList.add('no-media');
  }
};
