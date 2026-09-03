// Dev-mode-only diagnostic (see scripts.md's Selectors & Data Attributes
// section): a lightweight substitute for a full ESLint AST rule, which
// would need same-function flow inspection rather than this project's
// existing node-local pattern-matching lint rules. Runs once lazy.js has
// loaded every section's blocks, not just the first.
export default () => {
  const missing = document.querySelectorAll('.btn:not([data-testid])');
  if (!missing.length) return;
  // eslint-disable-next-line no-console -- this warning IS the diagnostic
  console.warn(`${missing.length} .btn element(s) missing data-testid:`, [...missing]);
};
