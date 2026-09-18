import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { loadStyle } from '../../scripts/ak.js';
import decorate from '../../blocks/carousel-media/carousel-media.js';

// Swap the global IntersectionObserver for a fake that captures its callback,
// so the neighbour-dim active-state wiring can be driven deterministically in
// a headless runner. Same pattern as image-sequence.test.js. Restored in
// afterEach. carousel-media.js looks up the global `IntersectionObserver`
// identifier at call time (not an imported binding), so this swap takes.
class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.targets = [];
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target) { this.targets.push(target); }

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

const photo = (src = 'a.jpg') => `<picture><img src="${src}" width="1600"></picture>`;
const video = (src = 'clip.mp4') => `<a href="${src}">${photo('poster.jpg')}</a>`;

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

const headingRow = (text = 'Our work') => `<div><div><h2>${text}</h2></div></div>`;
const mediaRow = (inner = photo()) => `<div><div>${inner}</div></div>`;
const blankRow = () => '<div><div></div></div>';

const block = (rowsHtml, classes = '') => {
  const el = document.createElement('div');
  el.className = `carousel-media ${classes}`.trim();
  el.innerHTML = rowsHtml.join('');
  document.body.append(el);
  return el;
};

describe('carousel-media', () => {
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

  it('hoists the heading into a centred header and builds a carousel region', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([headingRow('Our work'), mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    expect(el.getAttribute('role')).to.equal('region');
    expect(el.getAttribute('aria-roledescription')).to.equal('carousel');
    const header = el.querySelector('.carousel-media-header');
    expect(header).to.exist;
    const title = header.querySelector('.carousel-media-title');
    expect(title.tagName).to.equal('H2');
    expect(title.textContent).to.equal('Our work');
    // Header precedes the scroll stage.
    expect(el.firstElementChild).to.equal(header);
    expect(el.querySelector('.carousel-media-stage .carousel-media-viewport .carousel-media-track')).to.exist;
  });

  it('builds one slide per media cell with group/slide ARIA and a 1-based "N of total" label', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    const slides = [...el.querySelectorAll('.carousel-media-slide')];
    expect(slides).to.have.length(3);
    expect(slides[0].getAttribute('role')).to.equal('group');
    expect(slides[0].getAttribute('aria-roledescription')).to.equal('slide');
    expect(slides[0].getAttribute('aria-label')).to.equal('1 of 3');
    expect(slides[2].getAttribute('aria-label')).to.equal('3 of 3');
    expect(slides[0].querySelector('.carousel-media-slide-media img[src="a.jpg"]')).to.exist;
  });

  it('assigns a flat, continuous data-testid across the block even with a blank row interleaved', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), blankRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    const ids = [...el.querySelectorAll('.carousel-media-slide')].map((s) => s.dataset.testid);
    expect(ids).to.deep.equal([
      'carousel-media-slide-0',
      'carousel-media-slide-1',
      'carousel-media-slide-2',
    ]);
  });

  it('renders prev/next nav buttons with fallback labels and testids that scroll opposite directions', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    const prev = el.querySelector('.carousel-media-nav-prev');
    const next = el.querySelector('.carousel-media-nav-next');
    expect(prev.getAttribute('aria-label')).to.equal('Previous slide');
    expect(next.getAttribute('aria-label')).to.equal('Next slide');
    expect(prev.dataset.testid).to.equal('carousel-media-nav-prev');
    expect(next.dataset.testid).to.equal('carousel-media-nav-next');

    const viewport = el.querySelector('.carousel-media-viewport');
    const spy = sinon.spy(viewport, 'scrollBy');
    next.click();
    prev.click();
    expect(spy.firstCall.args[0].left).to.be.greaterThan(0);
    expect(spy.secondCall.args[0].left).to.be.lessThan(0);
  });

  // ANIMATING branch: shouldAnimate() true → one IntersectionObserver wired,
  // every slide observed and initially dimmed; the intersecting slide flips to
  // is-active while a non-intersecting one stays is-inactive.
  it('wires an IntersectionObserver that toggles is-active/is-inactive by ratio when motion is on', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    expect(FakeIntersectionObserver.instances).to.have.length(1);
    const io = FakeIntersectionObserver.instances[0];
    const slides = [...el.querySelectorAll('.carousel-media-slide')];
    expect(io.targets).to.have.length(3);
    // Seeded to avoid a dim->clear flash: first active, the rest dimmed.
    expect(slides[0].classList.contains('is-active')).to.be.true;
    expect(slides.slice(1).every((s) => s.classList.contains('is-inactive'))).to.be.true;

    io.callback([
      { target: slides[0], intersectionRatio: 0.8 },
      { target: slides[1], intersectionRatio: 0 },
    ]);
    expect(slides[0].classList.contains('is-active')).to.be.true;
    expect(slides[0].classList.contains('is-inactive')).to.be.false;
    expect(slides[1].classList.contains('is-active')).to.be.false;
    expect(slides[1].classList.contains('is-inactive')).to.be.true;
  });

  // STATIC / reduced-motion branch: shouldAnimate() false → no observer, every
  // slide is a valid full-clarity resting DOM (no is-active/is-inactive class).
  it('creates no observer and leaves all slides at full clarity when motion is off', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    expect(FakeIntersectionObserver.instances).to.have.length(0);
    const slides = [...el.querySelectorAll('.carousel-media-slide')];
    expect(slides).to.have.length(3);
    expect(slides.some((s) => s.classList.contains('is-inactive'))).to.be.false;
    expect(slides.some((s) => s.classList.contains('is-active'))).to.be.false;
    expect(slides[0].querySelector('img')).to.exist;
  });

  it('renders a single-slide block without throwing', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow()]);
    await decorate(el);
    expect(el.querySelectorAll('.carousel-media-slide')).to.have.length(1);
    expect(el.querySelector('.carousel-media-slide').getAttribute('aria-label')).to.equal('1 of 1');
  });

  it('ignores empty/blank rows and builds slides only from media cells', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([blankRow(), mediaRow(), blankRow(), mediaRow()]);
    await decorate(el);
    expect(el.querySelectorAll('.carousel-media-slide')).to.have.length(2);
  });

  it('works with no heading — no header, all cells become slides', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow()]);
    await decorate(el);
    expect(el.querySelector('.carousel-media-header')).to.not.exist;
    expect(el.querySelectorAll('.carousel-media-slide')).to.have.length(2);
  });

  it('makes the first video slide a muted autoplay video when motion is on', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(video()), mediaRow(photo('b.jpg'))]);
    await decorate(el);

    const firstSlide = el.querySelector('.carousel-media-slide');
    const vid = firstSlide.querySelector('video');
    expect(vid).to.exist;
    expect(vid.muted).to.be.true;
    expect(vid.loop).to.be.true;
    expect(vid.src).to.contain('clip.mp4');
    expect(vid.hasAttribute('autoplay')).to.be.false;
    // The authored .mp4 link is consumed, not left dangling in the DOM.
    expect(firstSlide.querySelector('a[href*=".mp4"]')).to.not.exist;
  });

  it('adds a labelled WCAG 2.2.2 pause control inside the first video slide', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(video()), mediaRow(photo('b.jpg'))]);
    await decorate(el);

    // addVideoPauseControl is async fire-and-forget (awaits placeholder labels).
    const toggle = await waitFor(
      () => el.querySelector('.carousel-media-slide-media .video-pause-toggle'),
    );
    expect(toggle.tagName).to.equal('BUTTON');
    expect(toggle.getAttribute('aria-pressed')).to.equal('false');
    expect(toggle.textContent.trim()).to.equal('Pause');
  });

  it('posterises every video slide after the first — no raw .mp4 link survives', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(video('one.mp4')), mediaRow(video('two.mp4')), mediaRow(photo())]);
    await decorate(el);

    const slides = [...el.querySelectorAll('.carousel-media-slide')];
    // First is the autoplay video; second is posterised to its picture only.
    expect(slides[1].querySelector('a[href*=".mp4"]')).to.not.exist;
    expect(slides[1].querySelector('video')).to.not.exist;
    expect(slides[1].querySelector('picture img')).to.exist;
    // No live .mp4 tab-stop anywhere in the block.
    expect(el.querySelector('a[href*=".mp4"]')).to.not.exist;
  });

  it('handles an all-video block (first autoplays, rest posterised)', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(video('one.mp4')), mediaRow(video('two.mp4')), mediaRow(video('three.mp4'))]);
    await decorate(el);

    expect(el.querySelectorAll('.carousel-media-slide')).to.have.length(3);
    expect(el.querySelectorAll('video')).to.have.length(1);
    expect(el.querySelectorAll('a[href*=".mp4"]')).to.have.length(0);
  });

  it('handles a single video-only slide', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(video())]);
    await decorate(el);
    const slides = el.querySelectorAll('.carousel-media-slide');
    expect(slides).to.have.length(1);
    expect(slides[0].getAttribute('aria-label')).to.equal('1 of 1');
    expect(el.querySelector('video')).to.exist;
    expect(el.querySelector('a[href*=".mp4"]')).to.not.exist;
  });

  it('falls back to the static poster for a video slide when motion is off', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block([mediaRow(video()), mediaRow()]);
    await decorate(el);
    const firstSlide = el.querySelector('.carousel-media-slide');
    expect(firstSlide.querySelector('video')).to.not.exist;
    expect(firstSlide.querySelector('picture img')).to.exist;
    expect(firstSlide.querySelector('a[href*=".mp4"]')).to.not.exist;
  });

  it('decorating an already-decorated element twice is a no-op', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);
    const firstStage = el.querySelector('.carousel-media-stage');
    await decorate(el);
    expect(el.querySelector('.carousel-media-stage')).to.equal(firstStage);
    expect(el.querySelectorAll('.carousel-media-nav-prev')).to.have.length(1);
    expect(FakeIntersectionObserver.instances).to.have.length(1);
  });

  it('announces the nearest-to-centre slide position after scrolling settles', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    const viewport = el.querySelector('.carousel-media-viewport');
    const slides = [...el.querySelectorAll('.carousel-media-slide')];
    const rect = (left, width) => ({
      left,
      width,
      right: left + width,
      top: 0,
      bottom: 0,
      height: 0,
      x: left,
      y: 0,
      toJSON: () => {},
    });
    sinon.stub(viewport, 'getBoundingClientRect').returns(rect(0, 800));
    sinon.stub(slides[0], 'getBoundingClientRect').returns(rect(-800, 640));
    sinon.stub(slides[1], 'getBoundingClientRect').returns(rect(80, 640));
    sinon.stub(slides[2], 'getBoundingClientRect').returns(rect(960, 640));

    viewport.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => { setTimeout(resolve, 400); });

    const liveRegion = document.body.querySelector('[role="status"]');
    expect(liveRegion).to.exist;
    expect(liveRegion.textContent).to.equal('2 of 3');
  });

  // Render verification against the REAL stylesheet: reads resolved computed
  // styles the source alone can't confirm — the centred scroll-snap track, and
  // the neighbour dim only taking effect on is-inactive (is-active is clear).
  it('resolves the centred scroll-snap layout and neighbour-dim from the real CSS', async () => {
    await loadStyle('/blocks/carousel-media/carousel-media.css');
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    await decorate(el);

    const viewport = el.querySelector('.carousel-media-viewport');
    const track = el.querySelector('.carousel-media-track');
    const slides = [...el.querySelectorAll('.carousel-media-slide')];
    expect(getComputedStyle(viewport).overflowX).to.equal('auto');
    expect(getComputedStyle(track).display).to.equal('flex');
    expect(getComputedStyle(slides[0]).scrollSnapAlign).to.equal('center');

    slides[0].classList.remove('is-inactive');
    slides[0].classList.add('is-active');
    slides[1].classList.add('is-inactive');
    expect(getComputedStyle(slides[0]).filter).to.equal('none');
    expect(getComputedStyle(slides[1]).filter).to.not.equal('none');
  });

  // Render verification of the centre-peek GEOMETRY (the piece the computed-
  // style test above can't prove): with the real CSS and a fixed width, the
  // first and last slides must scroll to true horizontal centre with a peek.
  it('centres the first and last slide with a real peek (real CSS, real layout)', async () => {
    await loadStyle('/blocks/carousel-media/carousel-media.css');
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(), mediaRow(), mediaRow()]);
    el.style.maxWidth = 'none';
    el.style.width = '800px';
    await decorate(el);

    const viewport = el.querySelector('.carousel-media-viewport');
    const track = el.querySelector('.carousel-media-track');
    const slides = [...el.querySelectorAll('.carousel-media-slide')];
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const centreOf = (node) => {
      const r = node.getBoundingClientRect();
      return r.left + r.width / 2;
    };
    const vp = viewport.getBoundingClientRect();
    const vpCentre = vp.left + vp.width / 2;

    // Slide is a fraction of the viewport, i.e. real peek room on both sides.
    // (Which fraction depends on the matched breakpoint of the WTR window; the
    // centring below holds regardless, since the spacer is always (1-basis)/2.)
    const slideW = slides[0].getBoundingClientRect().width;
    expect(slideW).to.be.lessThan(vp.width);
    expect(vp.width - slideW).to.be.greaterThan(80);

    // First slide centred at scrollLeft 0 (edge spacer does its job); the only
    // offset is the single gap between the leading spacer and the slide.
    viewport.scrollLeft = 0;
    expect(centreOf(slides[0])).to.be.closeTo(vpCentre, gap + 3);

    // Last slide centred at max scroll.
    viewport.scrollLeft = viewport.scrollWidth;
    expect(centreOf(slides.at(-1))).to.be.closeTo(vpCentre, gap + 3);
  });

  it('derives --carousel-media-ratio from the first slide media intrinsic w/h', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([
      mediaRow('<picture><img src="a.jpg" width="1600" height="900"></picture>'),
      mediaRow(),
    ]);
    await decorate(el);
    expect(el.style.getPropertyValue('--carousel-media-ratio')).to.equal('1600 / 900');
  });

  it('does not set --carousel-media-ratio when a dimension is zero/absent (CSS 16/9 fallback stays)', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([
      mediaRow('<picture><img src="a.jpg" width="1600" height="0"></picture>'),
      mediaRow(),
    ]);
    await decorate(el);
    expect(el.style.getPropertyValue('--carousel-media-ratio')).to.equal('');
  });

  it('sizes the decorated video to fill its slide (object-fit: cover from real CSS)', async () => {
    await loadStyle('/blocks/carousel-media/carousel-media.css');
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaRow(video()), mediaRow()]);
    await decorate(el);
    const vid = el.querySelector('video');
    expect(getComputedStyle(vid).objectFit).to.equal('cover');
  });
});
