import { initTileModal } from './tile-modal.js';
import { loadPartnerLogo } from '../../scripts/utils/media/partner-logo.js';
import { createElement } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

// Every cell is optional: the row filter below only drops fully-empty rows, so
// a row authored with just a name (no detail/link column) still reaches here —
// guard each cell rather than crash the whole block on a short row.
const rowToItem = (row) => {
  const [nameCell, detailCell, linkCell] = row.children;
  const link = linkCell?.querySelector('a[href]');
  return {
    name: nameCell?.textContent.trim() ?? '',
    detail: detailCell?.textContent.trim() ?? '',
    href: link?.href ?? '',
    linkText: link?.textContent.trim() ?? '',
  };
};

const buildTile = (item, i, openModal) => {
  const logo = createElement('span', { className: 'tt-logo', 'aria-hidden': 'true' });
  const label = createElement('span', { className: 'tt-label' }, item.name);
  const tile = createElement('button', { type: 'button', className: 'tt-tile' }, logo, label);
  tile.addEventListener('click', () => openModal(i, tile));
  loadPartnerLogo(logo, item.name);
  return tile;
};

export default async (el) => {
  // Guard re-decoration: replaceChildren(grid) below means a second pass would
  // read the grid's own tile <button>s as name/detail/link cells and rebuild
  // from garbage. See scripts.md Block Lifecycle.
  if (!guardDecorate(el, 'tileTable')) return;
  const items = [...el.children].filter((r) => r.textContent.trim()).map(rowToItem);
  const [prev, next, close, closed, visit, counter, opened] = await Promise.all([
    getPlaceholder('tileTablePrev', 'Previous'),
    getPlaceholder('tileTableNext', 'Next'),
    getPlaceholder('tileTableClose', 'Close'),
    getPlaceholder('tileTableClosed', 'Partner details closed'),
    getPlaceholder('tileTableVisit', 'Visit {name}'),
    getPlaceholder('tileTableCounter', '{current} of {total}'),
    getPlaceholder('tileTableOpened', '{name}, partner {current} of {total}'),
  ]);
  const openModal = initTileModal(items, {
    prev, next, close, closed, visit, counter, opened,
  });
  const grid = createElement('div', { className: 'tt-grid' });
  grid.append(...items.map((item, i) => buildTile(item, i, openModal)));
  el.replaceChildren(grid);
};
