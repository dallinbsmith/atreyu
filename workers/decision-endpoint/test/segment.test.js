// Plain node:test coverage for this Worker's pure-function modules — no
// build step, no new devDependency, no Cloudflare runtime needed since
// deriveSegment() is a plain data transform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSegment, DEFAULT_SEGMENT, ENTERPRISE_SEGMENT } from '../handlers/segment.js';

test('deriveSegment returns the enterprise segment above the employee threshold', () => {
  const reveal = { company: { metrics: { employees: 1001 } } };
  assert.equal(deriveSegment(reveal), ENTERPRISE_SEGMENT);
});

test('deriveSegment returns the default segment at exactly the threshold (not "over")', () => {
  const reveal = { company: { metrics: { employees: 1000 } } };
  assert.equal(deriveSegment(reveal), DEFAULT_SEGMENT);
});

test('deriveSegment returns the default segment below the threshold', () => {
  const reveal = { company: { metrics: { employees: 50 } } };
  assert.equal(deriveSegment(reveal), DEFAULT_SEGMENT);
});

test('deriveSegment fails open to the default segment when employee count is missing', () => {
  assert.equal(deriveSegment({ company: {} }), DEFAULT_SEGMENT);
  assert.equal(deriveSegment({}), DEFAULT_SEGMENT);
});

test('deriveSegment fails open to the default segment for a null/undefined reveal (Clearbit fail-open path)', () => {
  assert.equal(deriveSegment(null), DEFAULT_SEGMENT);
  assert.equal(deriveSegment(undefined), DEFAULT_SEGMENT);
});
