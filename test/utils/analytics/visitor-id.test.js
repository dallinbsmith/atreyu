import { expect } from '@esm-bundle/chai';
import { getVisitorId } from '../../../scripts/utils/analytics/visitor-id.js';

const VISITOR_KEY = 'atreyu-visitor-id';

describe('scripts/utils/analytics/visitor-id.js', () => {
  beforeEach(() => {
    localStorage.removeItem(VISITOR_KEY);
  });

  it('persists a visitor id when storage is available', () => {
    const id = getVisitorId();
    expect(localStorage.getItem(VISITOR_KEY)).to.equal(id);
    expect(getVisitorId()).to.equal(id);
  });

  it('falls back to a per-load id when localStorage throws', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('storage unavailable');
    };
    try {
      expect(getVisitorId()).to.be.a('string').and.not.equal('');
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
