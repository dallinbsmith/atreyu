import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import {
  setConfig, getConfig, loadBlock, decorateLink, loadArea, slugifyUnique,
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

describe('ak.js slugifyUnique — extracted, shared doc-wide de-dup slugifier', () => {
  // Extracted from decorateSection()'s `anchor` branch (real second consumer:
  // header-subcategories.js's decorateSubcategories()) — the anchor tests
  // below already cover this logic end-to-end through decorateSection; these
  // pin the function's own direct contract now that it's a standalone export.
  it('slugifies via toClassName rules (lowercase, punctuation to hyphens)', () => {
    expect(slugifyUnique('Q3 Launch!!')).to.equal('q3-launch');
  });

  it('de-dupes against an existing document id with a numeric suffix', () => {
    const el = document.createElement('div');
    el.id = 'features-standalone';
    document.body.append(el);
    expect(slugifyUnique('Features Standalone')).to.equal('features-standalone-2');
  });

  it('returns an empty string when the slug is empty (punctuation only), without an infinite loop', () => {
    expect(slugifyUnique('!!!')).to.equal('');
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

  it('multi-word metadata keys (aem-experimentation) become camelCase data attributes instead of throwing', async () => {
    const area = anchorArea([
      [['Experiment Variants', '/variant-b'], ['Campaign: Launch', '/launch']],
      [['note', 'still decorated']],
    ]);
    await loadArea({ area });
    const [first, second] = area.querySelectorAll('.section');
    expect(first.dataset.experimentVariants).to.equal('/variant-b');
    expect(first.dataset.campaignLaunch).to.equal('/launch');
    // the throw used to abort decorateSections for every remaining section
    expect(second.dataset.note).to.equal('still decorated');
  });
});

describe('ak.js loadBlock — framework-level re-entrancy guard', () => {
  before(() => {
    setConfig({ components: [], hostnames: [], linkBlocks: [] });
  });

  // A nonexistent block class 404s on its dynamic import (caught by
  // loadExperience's own .catch), same as any unrecognized block name would
  // in production — that failure path is what we're observing here, not
  // block content itself. Real trigger this guards against: DA Quick Edit's
  // content-change callback re-runs loadPage() -> loadArea() on the live
  // document, which would otherwise call loadBlock (and re-attempt the
  // import) on every already-loaded block a second time.
  it('does not re-attempt an already-loaded block\'s module import on a second call', async () => {
    const el = document.createElement('div');
    el.className = 'nonexistent-test-block-xyz';
    document.body.append(el);
    const log = sinon.spy();
    setConfig({
      components: [], hostnames: [], linkBlocks: [], log,
    });

    await loadBlock(el);
    await loadBlock(el);

    expect(el.dataset.blockStatus).to.equal('loaded');
    expect(log.callCount).to.equal(1); // the failed import was only attempted once
    el.remove();
  });
});

describe('ak.js decorateSections (via loadArea) — re-entrancy guard against double-wrapping', () => {
  before(() => {
    setConfig({ components: [], hostnames: [], linkBlocks: [], log: () => {} });
  });

  // A section shaped like real authored output: one top-level block div
  // (class = the block name) containing one row with one cell. groupChildren
  // wraps this in a single `.block-content` div on first decoration.
  const blockArea = () => {
    const area = document.createElement('div');
    const section = document.createElement('div');
    const blockEl = document.createElement('div');
    blockEl.className = 'nonexistent-test-block-abc';
    const row = document.createElement('div');
    const cell = document.createElement('div');
    cell.textContent = 'content';
    row.append(cell);
    blockEl.append(row);
    section.append(blockEl);
    area.append(section);
    document.body.append(area);
    return area;
  };

  it('a second loadArea call does not nest-wrap an already-wrapped section a second time', async () => {
    const area = blockArea();
    await loadArea({ area });
    const section = area.querySelector('.section');
    expect(section.querySelectorAll('.block-content').length).to.equal(1);
    expect(section.blocks).to.have.length(1);

    await loadArea({ area });
    // Without the sectionStatus guard, groupChildren() re-wraps the existing
    // .block-content div in a second .block-content layer — this would both
    // double the .block-content count and make the outer wrapper itself
    // match `.block-content > div[class]`, inflating section.blocks to 2.
    expect(section.querySelectorAll('.block-content').length).to.equal(1);
    expect(section.blocks).to.have.length(1);
    expect(section.blocks[0].className).to.equal('nonexistent-test-block-abc');
    area.remove();
  });
});

describe('ak.js decoratePictures (via loadArea) — re-entrancy guard against duplicate <source>', () => {
  before(() => {
    setConfig({ components: [], hostnames: [], linkBlocks: [], log: () => {} });
  });

  it('a second loadArea call does not clone a second grid-cap <source> onto the same picture', async () => {
    const area = document.createElement('div');
    const section = document.createElement('div');
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.setAttribute('srcset', '/media/img.png?width=750');
    source.setAttribute('media', '(min-width: 600px)');
    const img = document.createElement('img');
    img.src = '/media/img.png';
    picture.append(source, img);
    section.append(picture);
    area.append(section);
    document.body.append(area);

    await loadArea({ area });
    expect(picture.querySelectorAll('source').length).to.equal(2); // original + grid-cap clone

    await loadArea({ area });
    expect(picture.querySelectorAll('source').length).to.equal(2); // unchanged, not 3
    area.remove();
  });
});
