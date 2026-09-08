import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { decorateVideoMedia, addVideoPauseControl } from '../../scripts/utils/media.js';

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

// decorateVideoMedia's pause toggle is fire-and-forget (see the LCP-regression
// note in media.js) — a test that needs it has no choice but to poll for it,
// same as the real page would just render without it for a beat.
const waitFor = async (check, { timeout = 2000, interval = 10 } = {}) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => { setTimeout(resolve, interval); });
  }
  throw new Error('waitFor: condition never became true');
};

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

  it('does not await the pause-control setup — the caller-visible DOM mutation is synchronous', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const bg = document.createElement('div');
    bg.innerHTML = `<a href="/media/clip.mp4">${img}</a>`;
    decorateVideoMedia(bg); // not awaited on purpose — this must never block section reveal
    expect(bg.querySelector('video')).to.exist;
    expect(bg.querySelector('a[href*=".mp4"]')).to.not.exist;
    // the toggle itself depends on an async i18n lookup, so it's not here yet
    expect(bg.querySelector('.video-pause-toggle')).to.not.exist;
  });

  it('a pause click that lands before canplay suppresses the deferred autoplay (regression: canplay used to unconditionally play())', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const bg = document.createElement('div');
    bg.innerHTML = `<a href="/media/clip.mp4">${img}</a>`;
    decorateVideoMedia(bg); // fire-and-forget — the toggle isn't there yet

    const toggle = await waitFor(() => bg.querySelector('.video-pause-toggle'));
    const video = bg.querySelector('video');
    const playSpy = sinon.spy(video, 'play');

    toggle.click(); // user pauses while the video is still buffering
    expect(video.classList.contains('is-paused')).to.be.true;

    video.dispatchEvent(new Event('canplay'));
    expect(playSpy.called).to.be.false; // must NOT resume playback the user already declined
  });
});

describe('media utils — addVideoPauseControl', () => {
  it('adds a toggle that actually pauses/resumes the video, not just a CSS class (WCAG 2.2.2)', async () => {
    const bg = document.createElement('div');
    const video = document.createElement('video');
    bg.append(video);
    const onToggle = sinon.spy();

    await addVideoPauseControl(bg, video, onToggle);

    const toggle = bg.querySelector('.video-pause-toggle');
    expect(toggle).to.exist;

    const playSpy = sinon.spy(video, 'play');
    const pauseSpy = sinon.spy(video, 'pause');

    toggle.click();
    expect(video.classList.contains('is-paused')).to.be.true;
    expect(pauseSpy.calledOnce).to.be.true;
    expect(onToggle.calledWith(true)).to.be.true;

    toggle.click();
    expect(video.classList.contains('is-paused')).to.be.false;
    expect(playSpy.calledOnce).to.be.true;
    expect(onToggle.calledWith(false)).to.be.true;
  });
});
