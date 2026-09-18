import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { setViewport } from '@web/test-runner-commands';
import { loadStyle } from '../../scripts/ak.js';
import decorate from '../../blocks/carousel-with-touts/carousel-with-touts.js';

// This block installs NO IntersectionObserver (active-sync is scroll-settle
// driven). This minimal fake exists only so tests can assert one is never
// constructed - a regression guard, not a driver.
class FakeIntersectionObserver {
  constructor() { FakeIntersectionObserver.instances.push(this); }

  observe() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

const photo = (src = 'a.jpg') => `<picture><img src="${src}" width="1600" height="900"></picture>`;
const video = (src = 'clip.mp4') => `<a href="${src}">${photo('poster.jpg')}</a>`;
const tout = (n = 'One') => `<h6>${n}</h6><p>Body ${n}</p>`;

// A slide row = a media cell + a tout cell. Column ORDER is deliberately varied
// in some helpers to prove content-shape (not positional) classification.
const slideRow = (media = photo(), text = tout()) => `<div><div>${media}</div><div>${text}</div></div>`;
const toutFirstRow = (text = tout(), media = photo()) => `<div><div>${text}</div><div>${media}</div></div>`;
const mediaOnlyRow = (media = photo()) => `<div><div>${media}</div></div>`;
const toutOnlyRow = (text = tout()) => `<div><div>${text}</div></div>`;
const blankRow = () => '<div><div></div></div>';

const block = (rowsHtml, classes = '') => {
  const el = document.createElement('div');
  el.className = `carousel-with-touts ${classes}`.trim();
  el.innerHTML = rowsHtml.join('');
  document.body.append(el);
  return el;
};

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

describe('carousel-with-touts', () => {
  let originalIO;
  // The block caches ONE shared MediaQueryList (ariaMq) module-side and
  // registers ONE shared `change` listener the first time any instance
  // decorates. To drive that listener deterministically (a real setViewport
  // `change` event is flaky under concurrent browsers), we prime that singleton
  // ONCE with a controllable fake whose `matches` mirrors the real viewport
  // (so decorate-time ARIA tests still read the true breakpoint) but can be
  // force-overridden. `fireAria` is the captured shared listener; every
  // addEventListener call is recorded to prove the block never stacks them.
  let fireAria;
  let forceDesktop = null;
  const addedAriaListeners = [];

  before(async () => {
    const realMatch = window.matchMedia.bind(window);
    const fake = {
      media: '(width >= 768px)',
      get matches() { return forceDesktop ?? realMatch('(width >= 768px)').matches; },
      addEventListener: (_type, fn) => { fireAria = fn; addedAriaListeners.push(fn); },
      removeEventListener: () => {},
    };
    const stub = sinon.stub(window, 'matchMedia').returns(fake);
    const seed = document.createElement('div');
    seed.className = 'carousel-with-touts';
    seed.innerHTML = `${slideRow()}${slideRow()}${slideRow()}`;
    document.body.append(seed);
    await decorate(seed); // primes the module-level ariaMq to `fake`
    seed.remove();
    stub.restore();
  });

  beforeEach(async () => {
    originalIO = window.IntersectionObserver;
    window.IntersectionObserver = FakeIntersectionObserver;
    FakeIntersectionObserver.instances = [];
    // Default to a desktop viewport so matchMedia-driven ARIA is the carousel
    // mode unless a test opts into mobile.
    await setViewport({ width: 1024, height: 768 });
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    sinon.restore();
    forceDesktop = null; // reset any forced breakpoint override
    // Remove only the block elements, NOT the whole body: announce() appends a
    // module-singleton live region to body once and never re-appends, so wiping
    // body would detach it and break every later announce assertion.
    document.body.querySelectorAll('.carousel-with-touts').forEach((n) => n.remove());
  });

  // ---- structure -----------------------------------------------------------

  it('parses 3 rows into paired media+tout slides inside a device frame', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(photo('b.jpg'), tout('Two')), slideRow(photo('c.jpg'), tout('Three'))]);
    await decorate(el);

    const frame = el.querySelector('.cwt-frame');
    expect(frame).to.exist;
    const slides = [...el.querySelectorAll('.cwt-slide')];
    expect(slides).to.have.length(3);
    // Each slide carries its own media AND its own tout caption.
    expect(slides[0].querySelector('.cwt-media img[src="a.jpg"]')).to.exist;
    expect(slides[0].querySelector('.cwt-tout-title').textContent).to.equal('One');
    expect(slides[1].querySelector('.cwt-media img[src="b.jpg"]')).to.exist;
    expect(slides[2].querySelector('.cwt-tout-title').textContent).to.equal('Three');
    // Viewport/track live inside the frame.
    expect(el.querySelector('.cwt-frame .cwt-viewport .cwt-track')).to.exist;
  });

  it('classifies by content shape, not column order (tout-first rows still pair correctly)', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([toutFirstRow(tout('X'), photo('x.jpg')), slideRow(), slideRow()]);
    await decorate(el);
    const first = el.querySelector('.cwt-slide');
    expect(first.querySelector('.cwt-media img[src="x.jpg"]')).to.exist;
    expect(first.querySelector('.cwt-tout-title').textContent).to.equal('X');
  });

  it('builds one labelled pagination button per slide with prev/next nav', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(photo(), tout('Alpha')), slideRow(photo(), tout('Beta')), slideRow(photo(), tout('Gamma'))]);
    await decorate(el);

    const pages = [...el.querySelectorAll('.cwt-pagination .cwt-page')];
    expect(pages).to.have.length(3);
    expect(pages.map((p) => p.textContent)).to.deep.equal(['Alpha', 'Beta', 'Gamma']);
    expect(pages.every((p) => p.tagName === 'BUTTON')).to.be.true;

    const prev = el.querySelector('.cwt-nav-prev');
    const next = el.querySelector('.cwt-nav-next');
    expect(prev.dataset.testid).to.equal('cwt-nav-prev');
    expect(next.dataset.testid).to.equal('cwt-nav-next');
    expect(prev.getAttribute('aria-label')).to.equal('Previous slide');
    expect(next.getAttribute('aria-label')).to.equal('Next slide');
  });

  it('assigns a flat, continuous data-testid to slides and pages even past a blank row', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), blankRow(), slideRow(), slideRow()]);
    await decorate(el);
    expect([...el.querySelectorAll('.cwt-slide')].map((s) => s.dataset.testid))
      .to.deep.equal(['cwt-slide-0', 'cwt-slide-1', 'cwt-slide-2']);
    expect([...el.querySelectorAll('.cwt-page')].map((p) => p.dataset.testid))
      .to.deep.equal(['cwt-page-0', 'cwt-page-1', 'cwt-page-2']);
  });

  // ---- ARIA (responsive semantics) -----------------------------------------

  it('exposes carousel/slide semantics when decorated at a desktop width', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    // beforeEach set 1024: a real carousel region + slide groups.
    expect(el.getAttribute('role')).to.equal('region');
    expect(el.getAttribute('aria-roledescription')).to.equal('carousel');
    expect(el.getAttribute('aria-label')).to.equal('Carousel');
    const slides = [...el.querySelectorAll('.cwt-slide')];
    expect(slides[0].getAttribute('aria-roledescription')).to.equal('slide');
    expect(slides[2].getAttribute('aria-label')).to.equal('3 of 3');
  });

  it('strips carousel/slide semantics when decorated at a mobile width', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    await setViewport({ width: 500, height: 800 });
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    // A plain stacked read must not announce carousel/slide semantics.
    expect(el.getAttribute('role')).to.equal(null);
    expect(el.getAttribute('aria-roledescription')).to.equal(null);
    const slides = [...el.querySelectorAll('.cwt-slide')];
    expect(slides[0].getAttribute('role')).to.equal(null);
    expect(slides[0].getAttribute('aria-roledescription')).to.equal(null);
  });

  // ---- active-sync (scroll-settle is the single path, both motion branches) --

  it('syncs the active slide + tout + aria-current from scroll-settle when motion is on', async () => {
    await loadStyle('/blocks/carousel-with-touts/carousel-with-touts.css');
    await setViewport({ width: 1024, height: 768 });
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    // No IntersectionObserver: scroll-settle drives sync for every branch.
    expect(FakeIntersectionObserver.instances).to.have.length(0);
    const viewport = el.querySelector('.cwt-viewport');
    const slides = [...el.querySelectorAll('.cwt-slide')];
    const pages = [...el.querySelectorAll('.cwt-page')];
    // Seeded active: first slide + first tout.
    expect(slides[0].classList.contains('is-active')).to.be.true;
    expect(pages[0].getAttribute('aria-current')).to.equal('true');

    viewport.scrollLeft = viewport.clientWidth; // settle on slide index 1
    viewport.dispatchEvent(new Event('scroll'));
    await waitFor(() => pages[1].getAttribute('aria-current') === 'true');
    expect(slides[1].classList.contains('is-active')).to.be.true;
    expect(pages[1].classList.contains('is-active')).to.be.true;
    expect(slides[0].classList.contains('is-active')).to.be.false;
    expect(pages[0].getAttribute('aria-current')).to.equal(null);
  });

  it('scrolls to and activates a slide when its pagination button is clicked', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    const viewport = el.querySelector('.cwt-viewport');
    const spy = sinon.spy(viewport, 'scrollBy');
    const pages = [...el.querySelectorAll('.cwt-page')];
    pages[2].click();

    expect(spy.called).to.be.true;
    expect(pages[2].classList.contains('is-active')).to.be.true;
    expect(pages[2].getAttribute('aria-current')).to.equal('true');
    expect(el.querySelectorAll('.cwt-slide')[2].classList.contains('is-active')).to.be.true;
  });

  // ---- static / reduced-motion branch --------------------------------------

  it('creates no observer, keeps first slide/tout active, and arrows scroll instantly when motion is off', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    expect(FakeIntersectionObserver.instances).to.have.length(0);
    const slides = [...el.querySelectorAll('.cwt-slide')];
    const pages = [...el.querySelectorAll('.cwt-page')];
    expect(slides[0].classList.contains('is-active')).to.be.true;
    expect(pages[0].getAttribute('aria-current')).to.equal('true');
    expect(slides[0].querySelector('img')).to.exist;

    const viewport = el.querySelector('.cwt-viewport');
    const spy = sinon.spy(viewport, 'scrollBy');
    el.querySelector('.cwt-nav-next').click();
    el.querySelector('.cwt-nav-prev').click();
    expect(spy.firstCall.args[0].left).to.be.greaterThan(0);
    expect(spy.firstCall.args[0].behavior).to.equal('auto');
    expect(spy.secondCall.args[0].left).to.be.lessThan(0);
  });

  it('still syncs active state after an arrow / manual scroll when motion is off', async () => {
    await loadStyle('/blocks/carousel-with-touts/carousel-with-touts.css');
    await setViewport({ width: 1024, height: 768 });
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    expect(FakeIntersectionObserver.instances).to.have.length(0);
    const viewport = el.querySelector('.cwt-viewport');
    const slides = [...el.querySelectorAll('.cwt-slide')];
    const pages = [...el.querySelectorAll('.cwt-page')];
    // Reduced-motion users press an arrow (instant scroll) - the highlight and
    // aria-current must follow, not stay stuck on slide 0.
    el.querySelector('.cwt-nav-next').click();
    viewport.scrollLeft = viewport.clientWidth;
    viewport.dispatchEvent(new Event('scroll'));
    await waitFor(() => pages[1].getAttribute('aria-current') === 'true');
    expect(slides[1].classList.contains('is-active')).to.be.true;
    expect(pages[0].getAttribute('aria-current')).to.equal(null);
  });

  // ---- content-shape edges -------------------------------------------------

  it('makes the first video slide a muted looping video and consumes its .mp4 link', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(video(), tout('V')), slideRow(photo('b.jpg'), tout('P'))]);
    await decorate(el);

    const firstSlide = el.querySelector('.cwt-slide');
    const vid = firstSlide.querySelector('video');
    expect(vid).to.exist;
    expect(vid.muted).to.be.true;
    expect(vid.loop).to.be.true;
    expect(vid.src).to.contain('clip.mp4');
    expect(firstSlide.querySelector('a[href*=".mp4"]')).to.not.exist;
  });

  it('adds a labelled WCAG 2.2.2 pause control to the first video slide', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(video(), tout('V')), slideRow(photo('b.jpg'), tout('P'))]);
    await decorate(el);
    const toggle = await waitFor(() => el.querySelector('.cwt-media .video-pause-toggle'));
    expect(toggle.tagName).to.equal('BUTTON');
    expect(toggle.getAttribute('aria-pressed')).to.equal('false');
    expect(toggle.textContent.trim()).to.equal('Pause');
  });

  it('posterises every video slide after the first - no raw .mp4 link survives', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(video('one.mp4')), slideRow(video('two.mp4')), slideRow(photo())]);
    await decorate(el);
    const slides = [...el.querySelectorAll('.cwt-slide')];
    expect(slides[1].querySelector('video')).to.not.exist;
    expect(slides[1].querySelector('picture img')).to.exist;
    expect(el.querySelector('a[href*=".mp4"]')).to.not.exist;
  });

  it('falls back to the static poster for the first video slide when motion is off', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block([slideRow(video(), tout('V')), slideRow()]);
    await decorate(el);
    const firstSlide = el.querySelector('.cwt-slide');
    expect(firstSlide.querySelector('video')).to.not.exist;
    expect(firstSlide.querySelector('picture img')).to.exist;
    expect(firstSlide.querySelector('a[href*=".mp4"]')).to.not.exist;
  });

  it('tolerates a media-only slide and a tout-only slide without crashing', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([mediaOnlyRow(photo('m.jpg')), toutOnlyRow(tout('Solo')), slideRow()]);
    await decorate(el);

    const slides = [...el.querySelectorAll('.cwt-slide')];
    expect(slides).to.have.length(3);
    // Media-only slide: no tout, pagination falls back to the 1-based position.
    expect(slides[0].querySelector('.cwt-media img[src="m.jpg"]')).to.exist;
    expect(slides[0].querySelector('.cwt-tout-title')).to.not.exist;
    const pages = [...el.querySelectorAll('.cwt-page')];
    expect(pages[0].textContent).to.equal('1');
    // Tout-only slide: no media, tout still present + its pagination label.
    expect(slides[1].querySelector('.cwt-media')).to.not.exist;
    expect(slides[1].querySelector('.cwt-tout-title').textContent).to.equal('Solo');
    expect(pages[1].textContent).to.equal('Solo');
  });

  it('ignores empty rows and renders a single-slide block without throwing', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([blankRow(), slideRow(), blankRow()]);
    await decorate(el);
    expect(el.querySelectorAll('.cwt-slide')).to.have.length(1);
    expect(el.querySelector('.cwt-page').textContent).to.equal('One');
  });

  it('honours the blurred-background variant class', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()], 'blurred-background');
    await decorate(el);
    expect(el.classList.contains('blurred-background')).to.be.true;
  });

  it('is a no-op on an already-decorated element', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const frame = el.querySelector('.cwt-frame');
    await decorate(el);
    expect(el.querySelector('.cwt-frame')).to.equal(frame);
    expect(el.querySelectorAll('.cwt-nav-prev')).to.have.length(1);
    // The block installs no IntersectionObserver in either branch.
    expect(FakeIntersectionObserver.instances).to.have.length(0);
  });

  it('toggles carousel semantics on/off as the shared breakpoint listener fires', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const slides = [...el.querySelectorAll('.cwt-slide')];
    // Initial desktop (beforeEach 1024): carousel semantics present.
    expect(el.getAttribute('role')).to.equal('region');
    expect(slides[0].getAttribute('aria-roledescription')).to.equal('slide');
    // Cross below 768 -> the shared listener strips them.
    forceDesktop = false;
    fireAria();
    expect(el.getAttribute('role')).to.equal(null);
    expect(slides[0].getAttribute('aria-roledescription')).to.equal(null);
    // Cross back above 768 -> restored.
    forceDesktop = true;
    fireAria();
    expect(el.getAttribute('role')).to.equal('region');
    expect(slides[0].getAttribute('aria-label')).to.equal('1 of 3');
  });

  it('lets two blocks on one page each toggle their own ARIA independently', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const a = block([slideRow(), slideRow(), slideRow()]);
    const b = block([slideRow(), slideRow(), slideRow()]);
    await decorate(a);
    await decorate(b);
    expect(a.getAttribute('role')).to.equal('region');
    expect(b.getAttribute('role')).to.equal('region');
    // One shared listener drives BOTH instances.
    forceDesktop = false;
    fireAria();
    expect(a.getAttribute('role')).to.equal(null);
    expect(b.getAttribute('role')).to.equal(null);
    forceDesktop = true;
    fireAria();
    expect(a.getAttribute('role')).to.equal('region');
    expect(b.getAttribute('role')).to.equal('region');
  });

  it('does not stack listeners across a Quick-Edit re-decorate; the stale instance self-evicts', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const before2 = addedAriaListeners.length;
    // Quick Edit swaps in a FRESH el; the old one is detached (isConnected false).
    const stale = block([slideRow(), slideRow(), slideRow()]);
    await decorate(stale);
    stale.remove();
    const fresh = block([slideRow(), slideRow(), slideRow()]);
    await decorate(fresh);
    // Every registration used the SAME stable listener reference, so a real
    // addEventListener would dedup them to ONE - no per-instance stacking.
    const added = addedAriaListeners.slice(before2);
    expect(added.length).to.be.greaterThan(0);
    expect(new Set(added).size).to.equal(1);
    // Firing the shared listener updates the live fresh instance and skips +
    // self-evicts the detached stale one (its ARIA is left untouched).
    forceDesktop = false;
    fireAria();
    expect(fresh.getAttribute('role')).to.equal(null);
    expect(stale.getAttribute('role')).to.equal('region');
    // A second fire must not error on the already-evicted stale instance.
    forceDesktop = true;
    fireAria();
    expect(fresh.getAttribute('role')).to.equal('region');
  });

  // ---- real-render verification, BOTH breakpoints --------------------------

  it('resolves a horizontal scroll-snap carousel with visible controls on desktop (real CSS)', async () => {
    await loadStyle('/blocks/carousel-with-touts/carousel-with-touts.css');
    await setViewport({ width: 1024, height: 768 });
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    const viewport = el.querySelector('.cwt-viewport');
    const track = el.querySelector('.cwt-track');
    const slides = [...el.querySelectorAll('.cwt-slide')];
    expect(getComputedStyle(viewport).overflowX).to.equal('auto');
    expect(getComputedStyle(track).flexDirection).to.equal('row');
    expect(getComputedStyle(slides[0]).scrollSnapAlign).to.equal('start');
    // Controls + the in-slide tout hidden (pagination carries the labels).
    expect(getComputedStyle(el.querySelector('.cwt-nav-prev')).display).to.equal('flex');
    expect(getComputedStyle(el.querySelector('.cwt-pagination')).display).to.equal('grid');
    expect(getComputedStyle(slides[0].querySelector('.cwt-tout')).display).to.equal('none');
    // One slide fills the viewport -> real horizontal overflow to scroll.
    expect(track.scrollWidth).to.be.greaterThan(viewport.clientWidth + 1);
  });

  it('stacks vertically with NO horizontal scroll and hides arrows+pagination on mobile (real CSS)', async () => {
    await loadStyle('/blocks/carousel-with-touts/carousel-with-touts.css');
    await setViewport({ width: 500, height: 900 });
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    const viewport = el.querySelector('.cwt-viewport');
    const track = el.querySelector('.cwt-track');
    const slides = [...el.querySelectorAll('.cwt-slide')];
    expect(getComputedStyle(viewport).overflowX).to.equal('visible');
    expect(getComputedStyle(track).flexDirection).to.equal('column');
    // Tout caption visible; arrows + pagination gone.
    expect(getComputedStyle(slides[0].querySelector('.cwt-tout')).display).to.not.equal('none');
    expect(getComputedStyle(el.querySelector('.cwt-nav-prev')).display).to.equal('none');
    expect(getComputedStyle(el.querySelector('.cwt-pagination')).display).to.equal('none');
    // The defining mobile guarantee: the track does not overflow horizontally.
    expect(track.scrollWidth).to.be.at.most(viewport.clientWidth + 1);
    // Reset for the next test's default desktop expectation.
    await setViewport({ width: 1024, height: 768 });
  });

  it('announces the settled slide position after scrolling (real CSS, desktop)', async () => {
    await loadStyle('/blocks/carousel-with-touts/carousel-with-touts.css');
    await setViewport({ width: 1024, height: 768 });
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    const viewport = el.querySelector('.cwt-viewport');
    // Scroll to the LAST slide -> "3 of 3", a message no other test emits, so a
    // stale live-region value cannot false-pass this wait.
    viewport.scrollLeft = viewport.clientWidth * 2; // to slide index 2
    viewport.dispatchEvent(new Event('scroll'));
    await waitFor(() => document.body.querySelector('[role="status"]')?.textContent === '3 of 3');
  });

  it('clamps a negative overscroll scrollLeft to the first slide, not index -1 (real CSS)', async () => {
    await loadStyle('/blocks/carousel-with-touts/carousel-with-touts.css');
    await setViewport({ width: 1024, height: 768 });
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);

    const viewport = el.querySelector('.cwt-viewport');
    const slides = [...el.querySelectorAll('.cwt-slide')];
    const pages = [...el.querySelectorAll('.cwt-page')];
    // Move OFF slide 0 first so a regression (idx -1 de-highlighting all) shows.
    viewport.scrollLeft = viewport.clientWidth;
    viewport.dispatchEvent(new Event('scroll'));
    await waitFor(() => pages[1].getAttribute('aria-current') === 'true');
    // Emulate a left-edge rubber-band overscroll: scrollLeft reads negative
    // (real on macOS trackpads / iOS; a plain assignment would clamp to 0).
    const w = viewport.clientWidth;
    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, get: () => -w });
    viewport.dispatchEvent(new Event('scroll'));
    await waitFor(() => document.body.querySelector('[role="status"]')?.textContent === '1 of 3');
    expect(slides[0].classList.contains('is-active')).to.be.true;
    expect(pages[0].getAttribute('aria-current')).to.equal('true');
    // Exactly one active slide - an unclamped idx of -1 would have de-highlighted all.
    expect(el.querySelectorAll('.cwt-slide.is-active')).to.have.length(1);
  });

  it('anchors the video pause toggle inside its .cwt-media box (real CSS)', async () => {
    // styles.css carries the base .video-pause-toggle { position: absolute },
    // so this proves .cwt-media { position: relative } actually contains it
    // rather than letting it escape to the frame / bottom of the page.
    await loadStyle('/styles/styles.css');
    await loadStyle('/blocks/carousel-with-touts/carousel-with-touts.css');
    await setViewport({ width: 1024, height: 768 });
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block([slideRow(video(), tout('V')), slideRow(), slideRow()]);
    await decorate(el);

    const media = el.querySelector('.cwt-media');
    const toggle = await waitFor(() => media.querySelector('.video-pause-toggle'));
    expect(getComputedStyle(media).position).to.equal('relative');
    const m = media.getBoundingClientRect();
    const t = toggle.getBoundingClientRect();
    expect(t.left).to.be.at.least(m.left - 1);
    expect(t.right).to.be.at.most(m.right + 1);
    expect(t.top).to.be.at.least(m.top - 1);
    expect(t.bottom).to.be.at.most(m.bottom + 1);
  });
});
