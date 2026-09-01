// Authoring: one row.
// - One column: plain intro/section text — prefer default content instead
//   (see blocks.md "minimize block usage"); this block only exists so an
//   author who reaches for it still gets a sane, centered, width-capped
//   result rather than nothing.
// - Two columns: a genuine side-by-side text split (heading left, body
//   right) — matches Falkor's real `module.standaloneText` two-column mode,
//   which default content has no way to express on its own.

export default (el) => {
  const row = el.querySelector(':scope > div');
  if (!row) return;
  const cols = [...row.children];

  if (cols.length < 2) {
    el.classList.add('standalone-text-single');
    return;
  }

  el.classList.add('standalone-text-columns');
  cols[0].classList.add('standalone-text-heading');
  cols[1].classList.add('standalone-text-body');
};
