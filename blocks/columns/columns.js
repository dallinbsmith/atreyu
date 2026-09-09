const decorateCover = (col) => {
  // Classify by content shape, not a positional/nodeName check: a real authored
  // image column is nearly always `<p><picture>...</picture></p>` (the author
  // put the image on its own line), not a bare `<picture>` direct child — see
  // card.js's `pic.closest('p')` unwrap for the same shape. Only treat the
  // column as cover-image when the picture is its sole meaningful content,
  // never when it sits alongside real body text.
  const picture = col.querySelector(':scope > picture, :scope > p:only-child > picture:only-child');
  if (picture) {
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
