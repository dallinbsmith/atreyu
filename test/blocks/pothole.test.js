import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/pothole/pothole.js';

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'pothole';
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

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

describe('pothole', () => {
  it('moves the background picture into .pothole-background', () => {
    const el = block([img, '<h2>Title</h2><p>Body</p>']);
    decorate(el);
    expect(el.querySelector('.pothole-background picture')).to.exist;
    expect(el.querySelector('.pothole-background img').alt).to.equal('');
  });

  it('last row becomes .pothole-content', () => {
    const el = block([img, '<h2>Title</h2><p><a href="/a">Go</a></p>']);
    decorate(el);
    expect(el.querySelector('.pothole-content h2')).to.exist;
  });

  it('missing background row → no throw, no .pothole-background', () => {
    const el = block(['<h2>Just text</h2>']);
    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelector('.pothole-background')).to.not.exist;
  });

  it('classes CTA links as .btn with primary/secondary ordering', () => {
    const el = block([img, '<p><a href="/a">A</a></p><p><a href="/b">B</a></p>']);
    decorate(el);
    const links = el.querySelectorAll('.pothole-content a');
    expect(links[0].classList.contains('btn-primary')).to.be.true;
    expect(links[1].classList.contains('btn-secondary')).to.be.true;
  });

  it('[[eyebrow|x]] becomes span.rt-eyebrow inside the content', () => {
    const el = block([img, '<p>[[eyebrow|New]]</p><h2>Title</h2>']);
    decorate(el);
    expect(el.querySelector('.pothole-content .rt-eyebrow')).to.exist;
  });

  it('an author-provided second content row is merged in, not dropped', () => {
    const el = block([img, '<h2>Real content</h2>', '<p>Second row</p>']);
    decorate(el);
    const text = el.querySelector('.pothole-content').textContent;
    expect(text).to.include('Real content');
    expect(text).to.include('Second row');
  });

  it('a link already classed .btn (e.g. by decorateButton) is not re-classed positionally', () => {
    const el = block([img, '<p><a class="btn btn-accent" href="/a">A</a></p>']);
    decorate(el);
    const a = el.querySelector('.pothole-content a');
    expect(a.classList.contains('btn-accent')).to.be.true;
    expect(a.classList.contains('btn-primary')).to.be.false;
  });

  it('assigns pothole-cta-primary/secondary data-testid values', () => {
    const el = block([img, '<p><a href="/a">A</a></p><p><a href="/b">B</a></p>']);
    decorate(el);
    const links = el.querySelectorAll('.pothole-content a');
    expect(links[0].dataset.testid).to.equal('pothole-cta-primary');
    expect(links[1].dataset.testid).to.equal('pothole-cta-secondary');
  });

  it('an empty block does not throw', () => {
    const el = document.createElement('div');
    el.className = 'pothole';
    document.body.append(el);
    expect(() => decorate(el)).to.not.throw();
  });
});
