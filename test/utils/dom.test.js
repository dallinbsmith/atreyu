import { expect } from '@esm-bundle/chai';
import { createElement, parseSvg, getCells } from '../../scripts/utils/dom.js';

describe('utils/dom createElement', () => {
  it('creates an element with the given tag', () => {
    expect(createElement('div').tagName).to.equal('DIV');
  });

  it('sets className from attrs', () => {
    expect(createElement('div', { className: 'a b' }).className).to.equal('a b');
  });

  it('sets arbitrary attributes, including aria-*', () => {
    const el = createElement('div', { 'aria-hidden': 'true', 'data-x': '1' });
    expect(el.getAttribute('aria-hidden')).to.equal('true');
    expect(el.getAttribute('data-x')).to.equal('1');
  });

  it('sets a boolean-true attribute as an empty-value attribute', () => {
    const el = createElement('input', { disabled: true });
    expect(el.hasAttribute('disabled')).to.be.true;
    expect(el.getAttribute('disabled')).to.equal('');
  });

  it('skips null/undefined/false attribute values entirely', () => {
    const el = createElement('div', { title: null, hidden: false, 'data-x': undefined });
    expect(el.attributes.length).to.equal(0);
  });

  it('applies an object style attr via Object.assign', () => {
    const el = createElement('div', { style: { color: 'red' } });
    expect(el.style.color).to.equal('red');
  });

  it('appends string, node, and array children, flattening and dropping nullish entries', () => {
    const span = document.createElement('span');
    const el = createElement('div', null, 'text', span, [null, 'more', false]);
    expect(el.textContent).to.equal('textmore');
    expect(el.contains(span)).to.be.true;
  });

  it('works with no attrs and no children', () => {
    expect(() => createElement('div')).to.not.throw();
  });
});

describe('utils/dom getCells', () => {
  const block = (rows) => {
    const el = document.createElement('div');
    rows.forEach((cellCount) => {
      const row = document.createElement('div');
      for (let i = 0; i < cellCount; i += 1) row.append(document.createElement('div'));
      el.append(row);
    });
    return el;
  };

  it('flattens every row into a single array of its cells', () => {
    const el = block([2, 1, 3]);
    expect(getCells(el)).to.have.length(6);
  });

  it('returns an empty array for a block with no rows', () => {
    expect(getCells(document.createElement('div'))).to.deep.equal([]);
  });
});

describe('utils/dom parseSvg', () => {
  // Regression for a real, silent-failure bug (2026-09-09): DOMParser's XML
  // mode only assigns the correct SVG namespace when the markup itself
  // carries an explicit xmlns — a hand-written inline SVG constant (the
  // real use case for this function) never does, so parsing it that way
  // produced an element that quietly didn't render as SVG at all (zero
  // intrinsic size, fill="currentColor" ignored) while every other test
  // still passed. Asserting the namespace directly is what would have
  // caught it.
  it('assigns the real SVG namespace even when the markup has no xmlns attribute', () => {
    const svg = parseSvg('<svg viewBox="0 0 10 10" fill="currentColor"><path d="M0 0"/></svg>');
    expect(svg.namespaceURI).to.equal('http://www.w3.org/2000/svg');
  });

  it('preserves presentation attributes (e.g. fill) on the parsed element', () => {
    const svg = parseSvg('<svg viewBox="0 0 10 10" fill="currentColor"><path d="M0 0"/></svg>');
    expect(svg.getAttribute('fill')).to.equal('currentColor');
  });
});
