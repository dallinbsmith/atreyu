// Partner directory rendered from authored rows ([name, supported devices, link]),
// with a live client-side filter and result count. A framework would give the
// list + filtering state for free; here the state, filtering, and a11y live
// region are all wired by hand in vanilla JS.
export default (el) => {
  const rows = [...el.children].filter((r) => r.textContent.trim());
  rows.forEach((row) => {
    row.classList.add('tile-row');
    const [name, detail, action] = [...row.children];
    name?.classList.add('tile-name');
    detail?.classList.add('tile-detail');
    action?.classList.add('tile-action');
    row.querySelector('a')?.classList.add('btn', 'btn-link');
  });

  const controls = document.createElement('div');
  controls.className = 'tile-controls';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'tile-search';
  search.placeholder = 'Filter partners…';
  search.setAttribute('aria-label', 'Filter partners');
  const count = document.createElement('span');
  count.className = 'tile-count';
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  const setCount = (n) => { count.textContent = `${n} partner${n === 1 ? '' : 's'}`; };
  setCount(rows.length);

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    rows.forEach((row) => {
      const match = !q || row.textContent.toLowerCase().includes(q);
      row.hidden = !match;
      shown += match ? 1 : 0;
    });
    setCount(shown);
  });

  controls.append(search, count);
  el.prepend(controls);
};
