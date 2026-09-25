// Test-only block for test/scripts/ak-teardown.test.js: the pre-B1 contract,
// one parameter, ignoring the `{ signal }` second argument.
export default (el) => {
  el.dataset.legacyProbe = 'decorated';
};
