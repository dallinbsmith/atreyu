import { expect } from '@esm-bundle/chai';
import {
  setConfig, getConfig, loadBlock, decorateLink, loadArea,
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

describe('ak.js decorateSection — author-set anchor id', () => {
  before(() => {
    setConfig({
      components: [], hostnames: [], linkBlocks: [], log: () => {},
    });
  });

  // Build an area whose direct-child divs become sections (loadArea uses
  // `:scope > div` for a non-document area, and does not import lazy.js or
  // touch document/hash for a non-doc area — so this exercises the real
  // decorateSections path hermetically). Each section carries a
  // `.section-metadata` block with the given key/value rows, exactly as the
  // authoring pipeline delivers them. Anchor-only rows leave the section with
  // no dataset, so no section-metadata block module is dynamically loaded.
  const anchorArea = (sectionsRows) => {
    const area = document.createElement('div');
    sectionsRows.forEach((rows) => {
      const section = document.createElement('div');
      const meta = document.createElement('div');
      meta.className = 'section-metadata';
      rows.forEach(([k, v]) => {
        const row = document.createElement('div');
        const key = document.createElement('div');
        key.textContent = k;
        const val = document.createElement('div');
        val.textContent = v;
        row.append(key, val);
        meta.append(row);
      });
      section.append(meta);
      area.append(section);
    });
    document.body.append(area);
    return area;
  };

  it('promotes a reserved `anchor` metadata key to a real, slugified section id', async () => {
    const area = anchorArea([[['anchor', 'Pricing']]]);
    await loadArea({ area });
    expect(area.querySelector('.section').id).to.equal('pricing');
  });

  it('slugifies like a heading anchor — lowercase, spaces/punctuation to hyphens, trimmed', async () => {
    const area = anchorArea([[['anchor', 'Q3 Launch!!']]]);
    await loadArea({ area });
    expect(area.querySelector('.section').id).to.equal('q3-launch');
  });

  it('de-dupes a repeated anchor with a numeric suffix, in document order', async () => {
    const area = anchorArea([[['anchor', 'Plans']], [['anchor', 'Plans']]]);
    await loadArea({ area });
    const ids = [...area.querySelectorAll('.section')].map((s) => s.id);
    expect(ids).to.deep.equal(['plans', 'plans-2']);
  });

  it('de-dupes against an id already present elsewhere in the document (e.g. a heading anchor)', async () => {
    const heading = document.createElement('h2');
    heading.id = 'features';
    document.body.append(heading);
    const area = anchorArea([[['anchor', 'Features']]]);
    await loadArea({ area });
    expect(area.querySelector('.section').id).to.equal('features-2');
  });

  it('sets no id when the value slugs to empty (punctuation only)', async () => {
    const area = anchorArea([[['anchor', '!!!']]]);
    await loadArea({ area });
    expect(area.querySelector('.section').id).to.equal('');
  });

  it('handles a digit-leading slug through the CSS.escape de-dup path without throwing', async () => {
    // `#2024-roadmap` is an invalid *bare* CSS selector — the de-dup lookup on
    // the second section would throw without CSS.escape, so this locks in why
    // the escape is there, not just that it de-dupes.
    const area = anchorArea([[['anchor', '2024 Roadmap']], [['anchor', '2024 Roadmap']]]);
    await loadArea({ area });
    const ids = [...area.querySelectorAll('.section')].map((s) => s.id);
    expect(ids).to.deep.equal(['2024-roadmap', '2024-roadmap-2']);
  });

  it('an anchor alongside another metadata key sets the id and still lands the other key as a data attribute', async () => {
    const area = anchorArea([[['anchor', 'Deals'], ['note', 'internal']]]);
    await loadArea({ area });
    const section = area.querySelector('.section');
    expect(section.id).to.equal('deals');
    expect(section.dataset.note).to.equal('internal'); // anchor never also becomes data-anchor
  });
});
