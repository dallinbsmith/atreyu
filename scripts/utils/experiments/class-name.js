// Copy of ak.js's: experiment utilities and the panel must not load ak.js.
// Parity with ak.js: test/utils/experiments/to-class-name-parity.test.js.
export const toClassName = (name) => (typeof name === 'string'
  ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  : '');
