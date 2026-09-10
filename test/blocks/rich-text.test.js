import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/rich-text/rich-text.js';

// Build an EDS-shaped block: rows are divs, each cell is a div.
const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'rich-text';
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

describe('rich-text', () => {
  it('single row: applies .rich-text-content and decorates [[style|text]] markers', () => {
    const el = block(['<p>[[eyebrow|One]]</p><h2>Title</h2>']);
    decorate(el);
    const content = el.querySelector(':scope > div > div');
    expect(content.classList.contains('rich-text-content')).to.be.true;
    const span = content.querySelector('.rt-eyebrow');
    expect(span).to.exist;
    expect(span.textContent).to.equal('One');
  });

  it('a second authored row is merged into the first row\'s container and decorated', () => {
    const el = block(['<p>[[eyebrow|One]]</p>', '<p>[[eyebrow|TWO]]</p>']);
    decorate(el);
    // exactly one rich-text-content container — second row's cell merged in, not left standalone
    const contents = el.querySelectorAll('.rich-text-content');
    expect(contents).to.have.length(1);
    const content = contents[0];
    const spans = content.querySelectorAll('.rt-eyebrow');
    expect(spans).to.have.length(2);
    expect(spans[0].textContent).to.equal('One');
    expect(spans[1].textContent).to.equal('TWO');
    // no raw, unprocessed bracket syntax left behind anywhere in the block
    expect(el.textContent).to.not.include('[[');
  });

  it('no-wrapper fallback: decorates the block root itself when there is no :scope > div > div', () => {
    const el = document.createElement('div');
    el.className = 'rich-text';
    el.innerHTML = '<p>[[eyebrow|Root]]</p>';
    document.body.append(el);
    decorate(el);
    expect(el.classList.contains('rich-text-content')).to.be.true;
    const span = el.querySelector('.rt-eyebrow');
    expect(span).to.exist;
    expect(span.textContent).to.equal('Root');
  });

  it('classifies a paragraph containing a link with .rt-cta-para instead of relying on a structural selector', () => {
    const el = block(['<p>Body copy</p><p><a href="/a">Go</a></p>']);
    decorate(el);
    const ctaPara = el.querySelector('.rt-cta-para');
    expect(ctaPara).to.exist;
    expect(ctaPara.querySelector('a')).to.exist;
    expect(el.querySelector('.rich-text-content p:not(.rt-cta-para)').textContent).to.equal('Body copy');
  });

  it('double-decorate does not throw or duplicate content', () => {
    const el = block(['<p>[[eyebrow|One]]</p>', '<p>[[eyebrow|TWO]]</p>']);
    decorate(el);
    const htmlAfterFirst = el.querySelector('.rich-text-content').innerHTML;
    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelectorAll('.rich-text-content')).to.have.length(1);
    expect(el.querySelectorAll('.rt-eyebrow')).to.have.length(2);
    expect(el.querySelector('.rich-text-content').innerHTML).to.equal(htmlAfterFirst);
  });
});
