import { expect } from '@esm-bundle/chai';
import { isRealSegmentWriteKey, loadSegment } from '../../../scripts/utils/analytics/segment.js';

describe('scripts/utils/analytics/segment.js', () => {
  afterEach(() => {
    delete window.analytics;
    document.head.querySelectorAll('script[src*="cdn.segment.com/analytics.js"]').forEach((script) => script.remove());
  });

  it('treats placeholder and empty write keys as unconfigured', () => {
    expect(isRealSegmentWriteKey('REPLACE_WITH_REAL_SEGMENT_WRITE_KEY')).to.equal(false);
    expect(isRealSegmentWriteKey('')).to.equal(false);
    expect(isRealSegmentWriteKey('  ')).to.equal(false);
    expect(isRealSegmentWriteKey('real_write_key')).to.equal(true);
  });

  it('does not create the Segment stub or script when no real key is configured', () => {
    loadSegment();
    loadSegment('');
    expect(window.analytics).to.equal(undefined);
    expect(document.head.querySelector('script[src*="cdn.segment.com/analytics.js"]')).to.equal(null);
  });

  it('loads Segment when a real write key is configured', () => {
    loadSegment('real_write_key');
    expect(window.analytics.invoked).to.equal(true);
    const script = document.head.querySelector('script[src*="cdn.segment.com/analytics.js"]');
    expect(script.src).to.contain('/real_write_key/');
  });
});
