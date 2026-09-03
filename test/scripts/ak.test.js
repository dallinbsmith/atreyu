import { expect } from '@esm-bundle/chai';
import {
  setConfig, getConfig, loadBlock, decorateLink,
} from '../../scripts/ak.js';

const block = (className) => {
  const el = document.createElement('div');
  el.className = className;
  document.body.append(el);
  return el;
};

describe('ak.js loadBlock — data-variant mirroring', () => {
  before(() => {
    setConfig({ components: [], hostnames: [], linkBlocks: [] });
  });

  it('mirrors variant tokens (everything after the block name) into data-variant', async () => {
    const el = block('spacer large dark');
    await loadBlock(el);
    expect(el.dataset.blockName).to.equal('spacer');
    expect(el.dataset.variant).to.equal('large dark');
  });

  it('sets no data-variant when the block has no variant classes', async () => {
    const el = block('spacer');
    await loadBlock(el);
    expect(el.dataset.blockName).to.equal('spacer');
    expect(el.dataset.variant).to.be.undefined;
  });
});

describe('ak.js decorateButton — data-testid on markdown-emphasis buttons', () => {
  let config;

  before(() => {
    config = { ...getConfig(), hostnames: [], linkBlocks: [], log: () => {} };
  });

  const emphasizedLink = (tag, blockClass) => {
    const wrapper = document.createElement('div');
    if (blockClass) wrapper.innerHTML = `<div class="block-content"><div class="${blockClass}"><p><${tag}><a href="/a">Go</a></${tag}></p></div></div>`;
    else wrapper.innerHTML = `<p><${tag}><a href="/a">Go</a></${tag}></p>`;
    document.body.append(wrapper);
    return wrapper.querySelector('a');
  };

  // General form for combined-emphasis / underline cases the tag-only helper
  // above can't express — takes the raw markup for the <p> wrapper's contents.
  const rawLink = (innerHtml, blockClass) => {
    const wrapper = document.createElement('div');
    const p = `<p>${innerHtml}</p>`;
    wrapper.innerHTML = blockClass
      ? `<div class="block-content"><div class="${blockClass}">${p}</div></div>`
      : p;
    document.body.append(wrapper);
    return wrapper.querySelector('a');
  };

  it('derives data-testid from the nearest block ancestor and the applied variant', () => {
    const a = emphasizedLink('strong', 'hero');
    decorateLink(config, a);
    expect(a.classList.contains('btn-primary')).to.be.true;
    expect(a.dataset.testid).to.equal('hero-cta-primary');
  });

  it('reflects the actual variant applied (secondary from *italic*)', () => {
    const a = emphasizedLink('em', 'side-by-side');
    decorateLink(config, a);
    expect(a.classList.contains('btn-secondary')).to.be.true;
    expect(a.dataset.testid).to.equal('side-by-side-cta-secondary');
  });

  it('does not set data-testid when there is no block ancestor (plain content link)', () => {
    const a = emphasizedLink('strong', null);
    decorateLink(config, a);
    expect(a.classList.contains('btn-primary')).to.be.true;
    expect(a.dataset.testid).to.be.undefined;
  });

  it('negative variant from <del>', () => {
    const a = rawLink('<del><a href="/a">Go</a></del>', 'bookend');
    decorateLink(config, a);
    expect(a.classList.contains('btn-negative')).to.be.true;
    expect(a.dataset.testid).to.equal('bookend-cta-negative');
  });

  it('glass variant from combined ***bold italic***', () => {
    const a = rawLink('<em><strong><a href="/a">Go</a></strong></em>', 'hero');
    decorateLink(config, a);
    expect(a.classList.contains('btn-glass')).to.be.true;
    expect(a.dataset.testid).to.equal('hero-cta-glass');
  });

  it('bare <u> with no emphasis produces an outline-only testid', () => {
    const a = rawLink('<a href="/a"><u>Go</u></a>', 'hero');
    decorateLink(config, a);
    expect(a.classList.contains('btn-outline')).to.be.true;
    expect(a.dataset.testid).to.equal('hero-cta-outline');
  });

  it('a combined variant + underline keeps both distinguishable in the testid, not collapsed to just the first class', () => {
    const a = rawLink('<strong><a href="/a"><u>Go</u></a></strong>', 'hero');
    decorateLink(config, a);
    expect(a.classList.contains('btn-primary')).to.be.true;
    expect(a.classList.contains('btn-outline')).to.be.true;
    expect(a.dataset.testid).to.equal('hero-cta-primary-outline');
  });
});
