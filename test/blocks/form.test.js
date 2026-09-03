import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/form/form.js';

const block = (endpoint, fieldRows) => {
  const el = document.createElement('div');
  el.className = 'form';
  const mk = (cells) => {
    const row = document.createElement('div');
    cells.forEach((text) => {
      const cell = document.createElement('div');
      cell.textContent = text;
      row.append(cell);
    });
    return row;
  };
  el.append(mk([endpoint]));
  fieldRows.forEach((cells) => el.append(mk(cells)));
  document.body.append(el);
  return el;
};

describe('form', () => {
  it('builds a field input per field row and points the form at the endpoint row', () => {
    const el = block('/api/submit', [['Email', 'email']]);
    decorate(el);
    expect(el.querySelector('form')).to.exist;
    expect(el.querySelector('input[type="email"]')).to.exist;
  });

  it('defaults submit button text to "Submit" with no override row', () => {
    const el = block('/api/submit', [['Email', 'email']]);
    decorate(el);
    expect(el.querySelector('.form-submit').textContent).to.equal('Submit');
  });

  it('a trailing "submit: text" row overrides the button text and is not rendered as a field', () => {
    const el = block('/api/submit', [['Email', 'email'], ['submit: Send it']]);
    decorate(el);
    expect(el.querySelector('.form-submit').textContent).to.equal('Send it');
    expect(el.querySelectorAll('.form-field')).to.have.length(1);
  });

  it('a real field literally labeled "Submit" is rendered as a field, not consumed as the override', () => {
    const el = block('/api/submit', [['Email', 'email'], ['Submit', 'text']]);
    decorate(el);
    expect(el.querySelector('.form-submit').textContent).to.equal('Submit');
    expect(el.querySelectorAll('.form-field')).to.have.length(2);
    expect(el.querySelector('label[for="form-submit"]')).to.exist;
  });
});
