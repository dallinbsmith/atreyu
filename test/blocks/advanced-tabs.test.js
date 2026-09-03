import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/advanced-tabs/advanced-tabs.js';

// advanced-tabs reads sibling .section elements (within the same main/
// fragment-content) as panels, and the block's own <ul> as tab labels.
const build = (labels) => {
  const main = document.createElement('main');
  const currSection = document.createElement('div');
  currSection.className = 'section';
  const block = document.createElement('div');
  block.className = 'advanced-tabs';
  const ul = document.createElement('ul');
  labels.forEach((label) => {
    const li = document.createElement('li');
    li.textContent = label;
    ul.append(li);
  });
  block.append(ul);
  currSection.append(block);
  main.append(currSection);
  labels.forEach((label) => {
    const panel = document.createElement('div');
    panel.className = 'section';
    panel.textContent = `${label} panel`;
    main.append(panel);
  });
  document.body.append(main);
  return block;
};

describe('advanced-tabs', () => {
  it('builds a tablist with one tab per <li> and one panel per sibling section', () => {
    const el = build(['A', 'B', 'C']);
    decorate(el);
    expect(el.querySelectorAll('[role="tab"]')).to.have.length(3);
    expect(el.querySelectorAll('[role="tabpanel"]')).to.have.length(3);
  });

  it('activates only the first tab/panel initially', () => {
    const el = build(['A', 'B']);
    decorate(el);
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    const panels = [...el.querySelectorAll('[role="tabpanel"]')];
    expect(tabs[0].getAttribute('aria-selected')).to.equal('true');
    expect(panels[0].hasAttribute('hidden')).to.be.false;
    expect(panels[1].hasAttribute('hidden')).to.be.true;
  });

  it('clicking a tab activates it and shows only its panel', () => {
    const el = build(['A', 'B', 'C']);
    decorate(el);
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    const panels = [...el.querySelectorAll('[role="tabpanel"]')];
    tabs[2].click();
    expect(tabs[2].getAttribute('aria-selected')).to.equal('true');
    expect(tabs[0].getAttribute('aria-selected')).to.equal('false');
    expect(panels[2].hasAttribute('hidden')).to.be.false;
    expect(panels[0].hasAttribute('hidden')).to.be.true;
  });
});
