import { initTileModal } from './tile-modal.js';

export default (el) => {
  const rows = [...el.children].filter((r) => r.textContent.trim());
  const items = rows.map((row) => {
    const cols = [...row.children];
    const linkEl = cols[2]?.querySelector('a');
    return {
      name: cols[0]?.textContent.trim() ?? '',
      detail: cols[1]?.textContent.trim() ?? '',
      href: linkEl?.href ?? '',
      linkText: linkEl?.textContent.trim() ?? '',
    };
  });

  el.replaceChildren();
  const grid = document.createElement('div');
  grid.className = 'tt-grid';
  const openModal = initTileModal(items);

  items.forEach((item, i) => {
    const tile = document.createElement('button');
    tile.className = 'tt-tile';
    tile.type = 'button';
    const label = document.createElement('span');
    label.className = 'tt-label';
    label.textContent = item.name;
    tile.append(label);
    tile.addEventListener('click', () => openModal(i, tile));
    grid.append(tile);
  });

  el.append(grid);
};
