import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

describe('media utils — decorateVideoMedia', () => {
  afterEach(() => sinon.restore());

  it('under reduced motion, unwraps the mp4 link but keeps the poster picture (regression: used to remove both)', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const bg = document.createElement('div');
    bg.innerHTML = `<a href="/media/clip.mp4">${img}</a>`;
    decorateVideoMedia(bg);
    expect(bg.querySelector('picture')).to.exist;
    expect(bg.querySelector('a[href*=".mp4"]')).to.not.exist;
    expect(bg.querySelector('video')).to.not.exist;
  });

  it('no mp4 link — picture is left untouched', () => {
    const bg = document.createElement('div');
    bg.innerHTML = img;
    decorateVideoMedia(bg);
    expect(bg.querySelector('picture')).to.exist;
  });

  it('no picture at all — no-op, does not throw', () => {
    const bg = document.createElement('div');
    decorateVideoMedia(bg); // Mocha fails the test if this throws
    expect(bg.children.length).to.equal(0);
  });
});
