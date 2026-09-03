import { expect } from '@esm-bundle/chai';
import { createElement } from '../../scripts/utils/dom.js';

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
