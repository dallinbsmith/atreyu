import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';

// advanced-tabs.js caches getConfig().log at module load, so setConfig (with
// a log spy) must run before the block module is imported.
const logs = [];
setConfig({
  components: [], hostnames: [], linkBlocks: [], locales: { '': {} }, log: (msg) => logs.push(msg),
});
const { default: decorate } = await import('../../blocks/advanced-tabs/advanced-tabs.js');

// advanced-tabs reads sibling .section elements (within the same main/
// fragment-content) as panels, and the block's own <ul> as tab labels.
const build = (labels, panelCount = labels.length) => {
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
  labels.slice(0, panelCount).forEach((label) => {
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

  it('never leaves the parent hidden when the block has no authored <ul>', () => {
    const main = document.createElement('main');
    const currSection = document.createElement('div');
    currSection.className = 'section';
    const el = document.createElement('div');
    el.className = 'advanced-tabs';
    // no <ul> authored — this is the missing-content case
    currSection.append(el);
    main.append(currSection);
    document.body.append(main);

    decorate(el);

    expect(main.getAttribute('style')).to.not.exist;
    expect(main.style.display).to.not.equal('none');
  });

  it('skips tabs that have no matching section instead of throwing', () => {
    const el = build(['A', 'B', 'C'], 2);
    expect(() => decorate(el)).to.not.throw();
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).to.deep.equal(['A', 'B']);
    expect(el.querySelectorAll('[role="tabpanel"]')).to.have.length(2);
    tabs[1].click();
    expect(tabs[1].getAttribute('aria-selected')).to.equal('true');
  });

  it('with no sibling sections, leaves the <ul>, builds no empty tablist, un-hides the parent', () => {
    const el = build(['A'], 0);
    const main = el.closest('main');
    logs.length = 0;
    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelector('ul')).to.exist;
    expect(el.querySelector('[role="tablist"]')).to.not.exist;
    expect(main.style.display).to.not.equal('none');
    expect(logs).to.include('Advanced tabs: no sibling sections to use as panels.');
  });

  it('logs sections that have no tab label, and keeps them hidden', () => {
    const el = build(['A', 'B', 'C']);
    el.querySelector('li:last-child').remove();
    logs.length = 0;
    decorate(el);
    expect(logs).to.include('Advanced tabs: 1 section(s) have no tab label and will be hidden.');
    expect(el.querySelectorAll('[role="tab"]')).to.have.length(2);
    const sections = [...el.querySelectorAll(':scope > .section')];
    expect(sections).to.have.length(3);
    expect(sections[2].hasAttribute('hidden')).to.be.true;
  });

  it('is idempotent — a second decorate() does not rebuild tabs from a <ul> inside a panel', () => {
    const el = build(['A', 'B']);
    const list = document.createElement('ul');
    list.innerHTML = '<li>bullet one</li><li>bullet two</li>';
    el.closest('main').lastElementChild.append(list);
    decorate(el);
    const firstTabList = el.querySelector('.tab-list');
    decorate(el);
    expect(el.querySelectorAll('.tab-list')).to.have.length(1);
    expect(el.querySelector('.tab-list')).to.equal(firstTabList);
    expect(el.querySelectorAll('[role="tab"]')).to.have.length(2);
  });
});
