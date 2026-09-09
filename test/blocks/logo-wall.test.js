import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/logo-wall/logo-wall.js';

// getPlaceholder (placeholders.json) and loadPartnerLogo (/img/partners/*.svg)
// both hit the real (404-ing) test server and gracefully fall back to their
// English defaults / empty icon — same pattern already relied on by
// form.test.js/carousel.test.js, no fetch stubbing needed here.

const row = (html) => {
  const r = document.createElement('div');
  const cell = document.createElement('div');
  cell.innerHTML = html;
  r.append(cell);
  return r;
};

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'logo-wall';
  rowsHtml.forEach((html) => el.append(row(html)));
  document.body.append(el);
  return el;
};

const partners = [
  '<a href="https://acme.example.com">Acme</a>',
  '<a href="https://globex.example.com">Globex</a>',
  '<a href="https://initech.example.com">Initech</a>',
];

const names = (el) => [...el.querySelectorAll('.logo-wall-item .visually-hidden')]
  .map((label) => label.textContent);

describe('logo-wall', () => {
  afterEach(() => sinon.restore());

  it('builds accessible logo items with real names/hrefs from authored partner rows', async () => {
    // Force the non-animating branch — content correctness shouldn't depend
    // on whether the track gets cloned for the marquee.
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block(partners);
    await decorate(el);
    const items = [...el.querySelectorAll('.logo-wall-item')];
    expect(items).to.have.length(3);
    expect(names(el)).to.deep.equal(['Acme', 'Globex', 'Initech']);
    expect(items[0].tagName).to.equal('A');
    expect(items[0].getAttribute('href')).to.equal('https://acme.example.com/');
  });

  it('sequential double-decorate does not corrupt content (regression: content collapses into one garbled item)', async () => {
    // Force the non-animating branch here too, same reason as above.
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block(partners);
    await decorate(el);
    await decorate(el);
    expect(names(el)).to.deep.equal(['Acme', 'Globex', 'Initech']);
    expect(el.querySelectorAll('.logo-wall-item')).to.have.length(3);
  });

  it('concurrent double-decorate does not produce two pause-toggle buttons (regression: duplicate toggle wired to a detached viewport)', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block(partners);
    // Fire both without awaiting the first — this is what races the guard.
    const first = decorate(el);
    const second = decorate(el);
    await Promise.all([first, second]);
    expect(el.querySelectorAll('.logo-wall-toggle')).to.have.length(1);
    // and the live toggle must actually control the live, rendered viewport
    const toggle = el.querySelector('.logo-wall-toggle');
    const viewport = el.querySelector('.logo-wall-viewport');
    expect(viewport).to.exist;
    expect(el.contains(toggle)).to.be.true;
  });

  it('reduced-motion / shouldAnimate()-false path renders no pause toggle and no cloned duplicate track', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block(partners);
    await decorate(el);
    expect(el.querySelector('.logo-wall-toggle')).to.not.exist;
    expect(el.querySelectorAll('.logo-wall-track')).to.have.length(1);
    expect(el.querySelector('.logo-wall-viewport').classList.contains('is-animating')).to.be.false;
  });

  it('no authored rows → no-op, no throw', async () => {
    const el = block([]);
    await decorate(el); // Mocha fails the test if this rejects — no chai-as-promised needed
    expect(el.querySelector('.logo-wall-viewport')).to.not.exist;
  });
});
