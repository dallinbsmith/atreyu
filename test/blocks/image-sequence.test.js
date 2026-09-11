import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { loadStyle } from '../../scripts/ak.js';
import decorate from '../../blocks/image-sequence/image-sequence.js';

// Real IntersectionObserver timing is not deterministic in a headless test
// runner, and scroll.js's trackScrollProgress looks up the global
// `IntersectionObserver` identifier at call-time (not an imported binding) —
// so swapping the global constructor for a fake that captures its
// callback/options lets a test fire the "near viewport" entry manually and
// deterministically. Pattern matches footer-glow.test.js /
// hero-cards-transition.test.js. Restored in afterEach.
class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target) { this.target = target; }

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

// scroll.js's rAF-scheduled update() is real (not stubbed) — this waits a
// couple of real animation frames so a scheduled `update()` has actually run
// before we assert on its side effects (--progress / the scrub callback).
const nextFrames = (n = 2) => [...Array(n)].reduce(
  (p) => p.then(() => new Promise((resolve) => { requestAnimationFrame(resolve); })),
  Promise.resolve(),
);

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

// EDS-shaped block: a text row (heading) + a media row (an authored <a> to an
// .mp4, matching the real authoring convention documented in image-sequence.js
// — DA can't insert a <video> directly).
const block = ({ heading = 'One two three four', videoSrc = 'https://example.com/clip.mp4' } = {}) => {
  const el = document.createElement('div');
  el.className = 'image-sequence';

  const textRow = document.createElement('div');
  const textCell = document.createElement('div');
  const h2 = document.createElement('h2');
  h2.textContent = heading;
  textCell.append(h2);
  textRow.append(textCell);

  const mediaRow = document.createElement('div');
  const mediaCell = document.createElement('div');
  const a = document.createElement('a');
  a.setAttribute('href', videoSrc);
  a.textContent = videoSrc;
  mediaCell.append(a);
  mediaRow.append(mediaCell);

  el.append(textRow, mediaRow);
  document.body.append(el);
  return el;
};

describe('image-sequence', () => {
  let originalIO;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    window.IntersectionObserver = FakeIntersectionObserver;
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    sinon.restore();
    document.body.innerHTML = '';
  });

  it('normal decoration: splits heading text into per-word spans and wires the authored video for scrubbing', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block();
    decorate(el);

    const spans = [...el.querySelectorAll('.prompter-word')];
    expect(spans.map((s) => s.textContent)).to.deep.equal(['One', 'two', 'three', 'four']);

    const video = el.querySelector('video');
    expect(video).to.exist;
    expect(video.src).to.equal('https://example.com/clip.mp4');
    expect(video.muted).to.be.true;
    expect(video.playsInline).to.be.true;
    expect(video.hasAttribute('autoplay')).to.be.false;
  });

  // Fix 1 regression test: @property --count was registered with
  // `inherits: false`, but --count is only ever set on the parent
  // .prompter-text (never per-span) — with `inherits: false` every
  // .prompter-word's computed --count silently falls back to the registered
  // initial-value (0) instead of the parent's real word count, permanently
  // zeroing the --lit reveal formula. This loads the REAL image-sequence.css
  // and reads a real computed style, not the inline style JS wrote on the
  // parent, so it actually exercises the CSS cascade/inheritance bug.
  it('--count computed style on a per-word span reflects the real word count, not 0 (Fix 1 regression)', async () => {
    await loadStyle('/blocks/image-sequence/image-sequence.css');
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block({ heading: 'One two three four' });
    decorate(el);

    const span = el.querySelector('.prompter-word');
    const computedCount = getComputedStyle(span).getPropertyValue('--count').trim();
    expect(computedCount).to.equal('4');
  });

  it('double-decorate does not create a second IntersectionObserver', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block();
    decorate(el);
    decorate(el);
    expect(FakeIntersectionObserver.instances).to.have.length(1);
    expect(el.querySelectorAll('.prompter-word')).to.have.length(4);
  });

  // Fix 3 regression test: video.preload used to be set to 'auto'
  // unconditionally at decoration time, eagerly downloading the full video
  // for below-fold instances. It should start deferred and only bump once
  // trackScrollProgress's own IntersectionObserver (rootMargin: '100% 0px')
  // reports the block near-viewport.
  it('preload starts deferred and only bumps to auto once scroll tracking reports near-viewport (Fix 3)', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block();
    decorate(el);

    const video = el.querySelector('video');
    expect(video.preload).to.equal('metadata');
    expect(FakeIntersectionObserver.instances).to.have.length(1);

    FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true, target: el }]);
    await nextFrames();

    await waitFor(() => video.preload === 'auto');
    expect(video.preload).to.equal('auto');
  });

  // First progress tick can fire during Lazy (100% rootMargin, block sits
  // behind the hero) before the mp4 has duration. Without a loadedmetadata
  // retry the video stays at 0 until the next scroll.
  it('seeks on loadedmetadata when the first progress tick arrived before duration', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block();
    decorate(el);

    const video = el.querySelector('video');
    let duration = Number.NaN;
    let current = 0;
    Object.defineProperty(video, 'duration', { configurable: true, get: () => duration });
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => current,
      set: (v) => { current = Number(v); },
    });
    const rect = {
      top: -500,
      height: 2000,
      bottom: 1500,
      left: 0,
      right: 800,
      width: 800,
      x: 0,
      y: -500,
      toJSON: () => {},
    };
    sinon.stub(el, 'getBoundingClientRect').returns(rect);

    FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true, target: el }]);
    await nextFrames();
    await waitFor(() => video.preload === 'auto');
    expect(current).to.equal(0);

    duration = 10;
    video.dispatchEvent(new Event('loadedmetadata'));
    const p = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height - window.innerHeight, 1)));
    expect(current).to.be.closeTo(p * 10, 0.021);
  });

  it('reduced-motion / shouldAnimate()-false fallback: video gets native controls, no word-reveal, no scroll tracking', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block();
    decorate(el);

    const video = el.querySelector('video');
    expect(video.controls).to.be.true;
    expect(el.querySelector('.prompter-word')).to.not.exist;
    expect(el.classList.contains('prompter-scrub')).to.be.false;
    expect(FakeIntersectionObserver.instances).to.have.length(0);
  });
});
