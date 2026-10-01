import { expect } from '@esm-bundle/chai';
import { isSameOriginPath } from '../../../scripts/utils/analytics/experimentation.js';

describe('scripts/utils/analytics/experimentation.js', () => {
  it('rejects cross-origin paths and accepts same-origin relative paths', () => {
    expect(isSameOriginPath('//evil.example/x')).to.be.false;
    expect(isSameOriginPath('https://evil.example/x')).to.be.false;
    expect(isSameOriginPath('/safe-path')).to.be.true;
  });
});
