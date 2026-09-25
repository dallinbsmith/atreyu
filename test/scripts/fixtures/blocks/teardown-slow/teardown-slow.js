// Test-only block for test/scripts/ak-teardown.test.js: a slow module
// (top-level await) so a DOM swap can land while its import is in flight.
await new Promise((resolve) => { setTimeout(resolve, 60); });

export default (el, opts) => {
  window.teardownProbe?.set(el, opts);
};
