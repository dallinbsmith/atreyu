const decorateCover = (col) => {
  const children = [...col.children];
  if (children.length === 1 && children[0].nodeName === 'PICTURE') {
    col.classList.add('cover-image');
    col.parentElement.classList.add('cover-row');
  } else {
    col.classList.add('cover-content');
  }
};

const decorateCols = (el, cols) => {
  const hasCover = el.classList.contains('image-cover');
  for (const [idx, col] of cols.entries()) {
    col.classList.add('col', `col-${idx + 1}`);
    if (hasCover) decorateCover(col);
  }
};

const decorateRows = (el, rows) => {
  for (const [idx, row] of rows.entries()) {
    row.classList.add('row', `row-${idx + 1}`);
    const cols = [...row.children];
    row.style = `--child-count: ${cols.length}`;
    decorateCols(el, cols);
  }
};

export default (el) => {
  const rows = [...el.children];
  decorateRows(el, rows);
};
