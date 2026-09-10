import { initTileModal } from './tile-modal.js';
import { loadPartnerLogo } from '../../scripts/utils/partner-logo.js';
import { createElement } from '../../scripts/utils/dom.js';

const rowToItem = (row) => {
  const [nameCell, detailCell, linkCell] = row.children;
  const link = linkCell?.querySelector('a[href]');
  return {
    name: nameCell.textContent.trim(),
    detail: detailCell.textContent.trim(),
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

export default (el) => {
  const items = [...el.children].filter((r) => r.textContent.trim()).map(rowToItem);
  const openModal = initTileModal(items);
  const grid = createElement('div', { className: 'tt-grid' });
  grid.append(...items.map((item, i) => buildTile(item, i, openModal)));
  el.replaceChildren(grid);
};
