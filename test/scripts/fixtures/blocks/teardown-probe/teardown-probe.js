// Test-only block for test/scripts/ak-teardown.test.js: records the options
// ak.js's loadExperience passes as the second argument, keyed by element.
export default (el, opts) => {
  window.teardownProbe?.set(el, opts);
};
