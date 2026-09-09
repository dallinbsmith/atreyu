import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/carousel/carousel.js';

// Build an EDS-shaped block: each row is one slide, two columns (media, content).
const photo = (src = 'bg.jpg') => `<picture><img src="${src}" width="1600"></picture>`;
const logo = (src = 'logo.svg') => `<picture><img src="${src}" width="80"></picture>`;

const slideRow = ({
  media = photo(), withLogo = true, heading = 'Headline', cta = '<p><a href="/story">See Their Story</a></p>',
} = {}) => {
  const mediaCol = `<div>${media}</div>`;
  const contentCol = `<div>${withLogo ? logo() : ''}<h3>${heading}</h3>${cta}</div>`;
  return `<div>${mediaCol}${contentCol}</div>`;
};

// Real Google-Docs/DA authoring wraps an inserted image in its own <p> —
// the shape bentos.js's placeMedia() specifically defends against leaving
// behind as an empty paragraph once the image is extracted.
const slideRowWithPWrappedImages = () => `<div>
  <div><p>${photo()}</p></div>
  <div><p>${logo()}</p><h3>Headline</h3><p><a href="/story">See Their Story</a></p></div>
</div>`;

const block = (rowsHtml, classes = '') => {
  const el = document.createElement('div');
  el.className = `carousel ${classes}`.trim();
  el.innerHTML = rowsHtml.join('');
  document.body.append(el);
  return el;
};

describe('carousel', () => {
  it('fewer than 3 slides → no-op, no throw', async () => {
    const el = block([slideRow(), slideRow()]);
    await decorate(el);
    expect(el.querySelector('.carousel-viewport')).to.not.exist;
  });

  it('3+ slides → builds a viewport/track and a region with carousel semantics', async () => {
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    expect(el.getAttribute('role')).to.equal('region');
    expect(el.getAttribute('aria-roledescription')).to.equal('carousel');
    expect(el.querySelector('.carousel-viewport .carousel-track')).to.exist;
    expect(el.querySelectorAll('.carousel-slide')).to.have.length(3);
  });

  it('each slide gets group/slide semantics with a 1-based "N of total" label', async () => {
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const slides = [...el.querySelectorAll('.carousel-slide')];
    expect(slides[0].getAttribute('role')).to.equal('group');
    expect(slides[0].getAttribute('aria-roledescription')).to.equal('slide');
    expect(slides[0].getAttribute('aria-label')).to.equal('1 of 3');
    expect(slides[2].getAttribute('aria-label')).to.equal('3 of 3');
  });

  it('large photo becomes the full-bleed background, small logo is hoisted foreground', async () => {
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const slide = el.querySelector('.carousel-slide');
    expect(slide.querySelector('.carousel-slide-media img[src="bg.jpg"]')).to.exist;
    const logoEl = slide.querySelector('.carousel-slide-logo');
    expect(logoEl).to.exist;
    expect(logoEl.closest('.carousel-slide-media')).to.not.exist;
  });

  it('heading and CTA are decorated via the shared tout decorator', async () => {
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const slide = el.querySelector('.carousel-slide');
    expect(slide.querySelector('.carousel-slide-title').textContent).to.equal('Headline');
    const cta = slide.querySelector('.carousel-slide-cta a');
    expect(cta.classList.contains('btn')).to.be.true;
    expect(cta.getAttribute('href')).to.equal('/story');
  });

  it('unwraps authored columns — title/cta land as direct slide children, no leftover empty wrapper divs', async () => {
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const slide = el.querySelector('.carousel-slide');
    const kids = [...slide.children];
    expect(kids.some((c) => c.classList.contains('carousel-slide-title'))).to.be.true;
    expect(kids.some((c) => c.classList.contains('carousel-slide-cta'))).to.be.true;
    expect(kids.some((c) => !c.className && !c.textContent.trim())).to.be.false;
  });

  it('a slide with no logo renders without throwing and without a logo node', async () => {
    const el = block([slideRow({ withLogo: false }), slideRow(), slideRow()]);
    await decorate(el);
    expect(el.querySelectorAll('.carousel-slide')[0].querySelector('.carousel-slide-logo')).to.not.exist;
  });

  it('a slide with no media renders without a media wrapper and without throwing', async () => {
    const el = block([slideRow({ media: '' }), slideRow(), slideRow()]);
    await decorate(el);
    expect(el.querySelectorAll('.carousel-slide')[0].querySelector('.carousel-slide-media')).to.not.exist;
  });

  it('an image authored inside its own <p> (real Google-Docs shape) leaves no stray empty paragraph behind', async () => {
    const el = block([slideRowWithPWrappedImages(), slideRow(), slideRow()]);
    await decorate(el);
    const slide = el.querySelectorAll('.carousel-slide')[0];
    expect(slide.querySelector('.carousel-slide-media img')).to.exist;
    expect(slide.querySelector('.carousel-slide-logo')).to.exist;
    const emptyParas = [...slide.querySelectorAll('p')].filter((p) => !p.textContent.trim() && !p.querySelector('a'));
    expect(emptyParas).to.have.length(0);
  });

  it('a slide authored with two background-shaped photos keeps the first and removes the second (no stray picture)', async () => {
    const twoPhotos = slideRow({ media: `${photo('bg1.jpg')}${photo('bg2.jpg')}` });
    const el = block([twoPhotos, slideRow(), slideRow()]);
    await decorate(el);
    const slide = el.querySelectorAll('.carousel-slide')[0];
    expect(slide.querySelectorAll('.carousel-slide-media img')).to.have.length(1);
    expect(slide.querySelector('img[src="bg1.jpg"]')).to.exist;
    expect(slide.querySelector('img[src="bg2.jpg"]')).to.not.exist;
  });

  it('renders prev/next nav buttons with fallback labels and testids', async () => {
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const prev = el.querySelector('.carousel-nav-prev');
    const next = el.querySelector('.carousel-nav-next');
    expect(prev.getAttribute('aria-label')).to.equal('Previous slide');
    expect(next.getAttribute('aria-label')).to.equal('Next slide');
    expect(prev.dataset.testid).to.equal('carousel-nav-prev');
    expect(next.dataset.testid).to.equal('carousel-nav-next');
  });

  it('next/prev buttons scroll the viewport in opposite directions', async () => {
    const el = block([slideRow(), slideRow(), slideRow()]);
    await decorate(el);
    const viewport = el.querySelector('.carousel-viewport');
    const spy = sinon.spy(viewport, 'scrollBy');
    el.querySelector('.carousel-nav-next').click();
    el.querySelector('.carousel-nav-prev').click();
    expect(spy.callCount).to.equal(2);
    expect(spy.firstCall.args[0].left).to.be.greaterThan(0);
    expect(spy.secondCall.args[0].left).to.be.lessThan(0);
    sinon.restore();
  });
});
