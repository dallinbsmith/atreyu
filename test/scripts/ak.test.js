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
});
