// EDS-authored tables come through as bare <table><tbody><tr>... — when no
// <thead> is authored, promote the first body row into one and rewrite its
// cells as column headers. Remaining body rows get a hook class for
// row-level styling. Uses `.tHead`/`.tBodies`/`.cells` (child-scoped by
// definition) rather than descendant selectors, so nested tables aren't
// swept into an outer table's iteration.
import { createElement } from '../../scripts/utils/dom.js';

export default (el) => {
  for (const table of el.querySelectorAll('table')) {
    const tbody = table.tBodies[0];

    if (!table.tHead && tbody?.rows.length) {
      const headingRow = tbody.rows[0];
      table.createTHead().append(headingRow);
      for (const td of [...headingRow.cells]) {
        const th = createElement('th', { className: td.className, scope: 'col' }, ...td.childNodes);
        td.replaceWith(th);
      }
    }

    // `tbody.rows` is live — the promoted row moved into thead above and is
    // no longer in this collection, so no array-slicing or shift bookkeeping
    // is needed to exclude it.
    for (const row of tbody?.rows ?? []) row.classList.add('table-content-row');
  }
};
