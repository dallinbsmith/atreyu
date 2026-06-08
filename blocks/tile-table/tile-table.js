import { initTileModal } from './tile-modal.js';

const slugify = (name) => name.toLowerCase().replace(/\s+/g, '-');

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
    const logo = document.createElement('span');
    logo.className = 'tt-logo';
    const label = document.createElement('span');
    label.className = 'tt-label';
    label.textContent = item.name;
    tile.append(logo, label);
    tile.addEventListener('click', () => openModal(i, tile));
    grid.append(tile);

    fetch(`/icons/partners/${slugify(item.name)}.svg`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((svg) => {
        logo.innerHTML = svg;
        const svgEl = logo.querySelector('svg');
        const vb = svgEl?.getAttribute('viewBox')?.split(/\s+/).map(Number);
        if (vb?.length === 4) {
          const h = Math.min(vb[3], 24);
          const w = vb[2] * (h / vb[3]);
          svgEl.style.width = `${Math.round(w)}px`;
          svgEl.style.height = `${Math.round(h)}px`;
        }
      })
      .catch(() => {});
  });

  el.append(grid);
};
