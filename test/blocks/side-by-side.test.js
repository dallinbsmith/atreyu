import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/side-by-side/side-by-side.js';
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { decorateTout } from '../../scripts/utils/touts.js';

// Build an EDS-shaped block: rows are divs, each cell is a div.
const block = (classes, rowsHtml) => {
  const el = document.createElement('div');
  el.className = `side-by-side ${classes}`.trim();
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

const img = '<picture><img src="m.jpg"></picture>';
const touts = (n) => `<ul>${Array.from({ length: n }, (_, i) => `<li><h3>T${i}</h3><p>body ${i}</p><p><a href="/${i}">go</a></p></li>`).join('')}</ul>`;

describe('side-by-side', () => {
  it('partitions media into .side-by-side-media and text into .side-by-side-text', () => {
    const el = block('', ['<h2>Title</h2><p>Body copy</p>', img]);
    decorate(el);
    expect(el.querySelector('.side-by-side-media picture')).to.exist;
    expect(el.querySelector('.side-by-side-text .side-by-side-title h2')).to.exist;
    expect(el.querySelector('.side-by-side-body')).to.exist;
  });

  it('media region in DOM comes after text region (a11y reading order)', () => {
    const el = block('', ['<h2>Title</h2>', img]);
    decorate(el);
    const kids = [...el.children];
    expect(kids.indexOf(el.querySelector('.side-by-side-text')))
      .to.be.lessThan(kids.indexOf(el.querySelector('.side-by-side-media')));
  });

  it('missing media → .no-media and no throw', () => {
    const el = block('', ['<h2>Just text</h2><p>copy</p>']);
    expect(() => decorate(el)).to.not.throw();
    expect(el.classList.contains('no-media')).to.be.true;
    expect(el.querySelector('.side-by-side-media')).to.not.exist;
  });

  it('0 touts → no touts node', () => {
    const el = block('', ['<h2>Title</h2>', img]);
    decorate(el);
    expect(el.querySelector('.side-by-side-touts')).to.not.exist;
  });

  it('1 tout → --tout-count:1 and one tout node', () => {
    const el = block('', ['<h2>Title</h2>', img, touts(1)]);
    decorate(el);
    const grid = el.querySelector('.side-by-side-touts');
    expect(grid.style.getPropertyValue('--tout-count')).to.equal('1');
    expect(grid.querySelectorAll('.side-by-side-tout')).to.have.length(1);
  });

  it('3 touts → --tout-count:3 and three tout nodes with titles', () => {
    const el = block('', ['<h2>Title</h2>', img, touts(3)]);
    decorate(el);
    const grid = el.querySelector('.side-by-side-touts');
    expect(grid.style.getPropertyValue('--tout-count')).to.equal('3');
    expect(grid.querySelectorAll('.side-by-side-tout-title')).to.have.length(3);
  });

  it('tout CTA preserves .btn classes', () => {
    const el = block('', ['<h2>Title</h2>', img, touts(1)]);
    decorate(el);
    const cta = el.querySelector('.side-by-side-tout-cta a');
    expect(cta.classList.contains('btn')).to.be.true;
    expect(cta.classList.contains('btn-primary')).to.be.true;
  });

  it('media-right class is preserved on the block', () => {
    const el = block('media-right', ['<h2>Title</h2>', img]);
    decorate(el);
    expect(el.classList.contains('media-right')).to.be.true;
  });

  it('idempotent — double call produces no duplicate wrappers or re-processed CTAs', () => {
    const el = block('', ['<h2>Title</h2>', img, touts(1)]);
    decorate(el);
    const btnCount = el.querySelectorAll('.btn').length;
    decorate(el);
    expect(el.querySelectorAll('.side-by-side-media')).to.have.length(1);
    expect(el.querySelectorAll('.side-by-side-text')).to.have.length(1);
    expect(el.querySelectorAll('.btn')).to.have.length(btnCount);
  });

  it('normalizes a non-h2 primary heading to a single h2', () => {
    const el = block('', ['<h1>Big</h1><h3>Sub</h3><p>copy</p>', img]);
    decorate(el);
    expect(el.querySelectorAll('.side-by-side-title h2')).to.have.length(1);
    expect(el.querySelector('.side-by-side-subhead')).to.exist;
  });

  it('[[eyebrow|x]] becomes span.rt-eyebrow inside the title region', () => {
    const el = block('', ['<p>[[eyebrow|New]]</p><h2>Title</h2>', img]);
    decorate(el);
    expect(el.querySelector('.side-by-side-title .rt-eyebrow')).to.exist;
    expect(el.querySelector('.side-by-side-title .rt-eyebrow').textContent).to.equal('New');
  });

  it('keeps loading=lazy and sets decoding=async on the image', () => {
    const el = block('', ['<h2>Title</h2>', img]);
    decorate(el);
    const image = el.querySelector('.side-by-side-media img');
    expect(image.getAttribute('loading')).to.equal('lazy');
    expect(image.getAttribute('decoding')).to.equal('async');
  });
});

describe('utils/richtext decorateRichText', () => {
  it('converts [[style|text]] to span.rt-style within the given scope only', () => {
    const scope = document.createElement('div');
    scope.innerHTML = '<p>before [[highlight|hi]] after</p>';
    decorateRichText(scope);
    const span = scope.querySelector('.rt-highlight');
    expect(span).to.exist;
    expect(span.textContent).to.equal('hi');
  });

  it('no-ops on a null scope without throwing', () => {
    expect(() => decorateRichText(null)).to.not.throw();
  });
});

describe('utils/touts decorateTout', () => {
  it('applies prefixed title/body classes and lifts CTAs', () => {
    const el = document.createElement('div');
    el.innerHTML = '<h3>Head</h3><p>copy</p><p><a href="/a">A</a></p><p><a href="/b">B</a></p>';
    decorateTout(el, 'side-by-side-tout');
    expect(el.querySelector('.side-by-side-tout-title')).to.exist;
    expect(el.querySelector('.side-by-side-tout-body')).to.exist;
    const links = el.querySelectorAll('.side-by-side-tout-cta a');
    expect(links).to.have.length(2);
    expect(links[0].classList.contains('btn-primary')).to.be.true;
    expect(links[1].classList.contains('btn-secondary')).to.be.true;
  });

  it('defers to a framework-classed .btn link instead of overriding its variant', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>copy</p><p><a class="btn btn-accent" href="/a">A</a></p>';
    decorateTout(el, 'tout');
    const a = el.querySelector('.tout-cta a');
    expect(a.classList.contains('btn-accent')).to.be.true;
    expect(a.classList.contains('btn-primary')).to.be.false;
  });

  it('hoists an authored icon above the title and removes its empty wrapper', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p><span class="icon icon-bolt"></span></p><h3>Head</h3><p>copy</p>';
    decorateTout(el, 'tout');
    expect(el.firstElementChild.classList.contains('tout-icon')).to.be.true;
    expect(el.firstElementChild.classList.contains('icon')).to.be.true;
    expect(el.querySelectorAll('p')).to.have.length(1); // empty icon <p> gone, body stays
  });
});
