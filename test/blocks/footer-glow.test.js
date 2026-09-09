import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/footer-glow/footer-glow.js';

// Real IntersectionObserver timing is not deterministic in a headless test
// runner, and motion.js's onReveal looks up the global `IntersectionObserver`
// identifier at call-time (not an imported binding) — so swapping the global
// constructor for a fake that captures its callback/target lets a test fire
// the "revealed" entry manually and deterministically. Restored in afterEach.
class FakeIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target) { this.target = target; }

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

// shouldAnimate() (scripts/utils/motion/motion.js) requires
// navigator.hardwareConcurrency >= 4 — stubbing it is the same technique
// test/utils/media.test.js already uses to force the animate vs.
// reduced-motion/low-end branch deterministically, without touching
// prefers-reduced-motion (which motion.js freezes at module-import time and
// can't be re-stubbed per test).
const waitFor = async (check, { timeout = 2000, interval = 10 } = {}) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, interval); });
  }
  throw new Error('waitFor: condition never became true');
};

const block = (rowsHtml = []) => {
  const el = document.createElement('div');
  el.className = 'footer-glow';
  rowsHtml.forEach((html) => {
    const row = document.createElement('div');
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
    el.append(row);
  });
  document.body.append(el);
  return el;
};

describe('footer-glow', () => {
  let originalIO;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    window.IntersectionObserver = FakeIntersectionObserver;
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    sinon.restore();
  });

  it('reduced-motion/low-end branch builds a poster <img>, no video, no observer', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block();
    decorate(el);
    expect(el.querySelector('.footer-glow-media img')).to.exist;
    expect(el.querySelector('video')).to.not.exist;
    expect(FakeIntersectionObserver.instances).to.have.length(0);
  });

  it('animate branch builds a <video> with the pause toggle once revealed', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block();
    decorate(el);

    expect(FakeIntersectionObserver.instances).to.have.length(1);
    FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true, target: el }]);

    const video = await waitFor(() => el.querySelector('video'));
    expect(video.loop).to.be.true;
    expect(video.autoplay).to.be.true;
    expect(video.muted).to.be.true;

    const toggle = await waitFor(() => el.querySelector('.footer-glow-toggle'));
    expect(toggle.tagName).to.equal('BUTTON');
    expect(toggle.textContent).to.equal('Pause');
  });

  it('clicking the toggle pauses/resumes the actual <video> element, not just a CSS class', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block();
    decorate(el);
    FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true, target: el }]);

    const video = await waitFor(() => el.querySelector('video'));
    const toggle = await waitFor(() => el.querySelector('.footer-glow-toggle'));
    const pauseSpy = sinon.spy(video, 'pause');
    const playSpy = sinon.spy(video, 'play');

    toggle.click();
    expect(pauseSpy.callCount).to.equal(1);
    expect(toggle.textContent).to.equal('Play');
    expect(toggle.getAttribute('aria-pressed')).to.equal('true');

    toggle.click();
    expect(playSpy.callCount).to.equal(1);
    expect(toggle.textContent).to.equal('Pause');
  });

  it('double-decorate does not create a second IntersectionObserver or duplicate media', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block();
    decorate(el);
    decorate(el);
    expect(FakeIntersectionObserver.instances).to.have.length(1);
    expect(el.querySelectorAll('.footer-glow-media')).to.have.length(1);
    expect(el.querySelectorAll('.footer-glow-gradient')).to.have.length(1);
  });

  it('an authored override row supplies the video src and poster', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block(['<a href="https://example.com/clip.mp4">clip</a><img src="https://example.com/poster.jpg">']);
    decorate(el);
    FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true, target: el }]);

    const video = await waitFor(() => el.querySelector('video'));
    expect(video.src).to.equal('https://example.com/clip.mp4');
    expect(video.poster).to.equal('https://example.com/poster.jpg');
  });

  it('with no authored override, falls back to the default poster in the reduced-motion branch', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block();
    decorate(el);
    const img = el.querySelector('.footer-glow-media img');
    expect(img.src).to.contain('bookend-glow.jpg');
  });
});
