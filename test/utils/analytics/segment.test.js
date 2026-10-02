import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import {
  isRealSegmentWriteKey,
  loadSegment,
  resetSegmentForTest,
} from '../../../scripts/utils/analytics/segment.js';

describe('scripts/utils/analytics/segment.js', () => {
  let append;

  beforeEach(() => {
    append = sinon.stub(document.head, 'appendChild');
  });

  afterEach(() => {
    append.restore();
    resetSegmentForTest();
    delete window.analytics;
    document.head.querySelectorAll('script[src*="cdn.segment.com/analytics.js"]').forEach((script) => script.remove());
  });

  it('treats placeholder and empty write keys as unconfigured', () => {
    expect(isRealSegmentWriteKey('REPLACE_WITH_REAL_SEGMENT_WRITE_KEY')).to.equal(false);
    expect(isRealSegmentWriteKey('')).to.equal(false);
    expect(isRealSegmentWriteKey('  ')).to.equal(false);
    expect(isRealSegmentWriteKey('real_write_key')).to.equal(true);
  });

  it('does not create the Segment stub or script when no real key is configured or the tier is not prod', () => {
    loadSegment();
    loadSegment('', 'prod');
    loadSegment('real_write_key', 'stage');
    expect(window.analytics).to.equal(undefined);
    expect(append.called).to.equal(false);
  });

  it('loads Segment on prod when a real write key is configured', () => {
    loadSegment('real_write_key', 'prod');
    expect(window.analytics.invoked).to.equal(true);
    const [script] = append.firstCall.args;
    expect(script.src).to.contain('/real_write_key/');
  });
});
