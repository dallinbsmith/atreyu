// Authoring: one row.
// - One column: plain intro/section text — prefer default content instead
//   (see blocks.md "minimize block usage"); this block only exists so an
//   author who reaches for it still gets a sane, centered, width-capped
//   result rather than nothing.
// - Two columns: a genuine side-by-side text split (heading left, body
//   right) — matches Falkor's real `module.standaloneText` two-column mode,
//   which default content has no way to express on its own.

export default (el) => {
  const row = el.firstElementChild;
  if (!row) return;
  const [heading, body] = row.children;

  el.classList.add(body ? 'standalone-text-columns' : 'standalone-text-single');
  if (!body) return;
  heading.classList.add('standalone-text-heading');
  body.classList.add('standalone-text-body');
};
