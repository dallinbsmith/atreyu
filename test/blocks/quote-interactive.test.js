import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/quote-interactive/quote-interactive.js';
import { loadArea, setConfig } from '../../scripts/ak.js';

const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';
const SCROLL_TRIGGER_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js';

const scriptFor = (src) => [...document.scripts].find((script) => script.getAttribute('src') === src);
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

// Polls until `check()` is truthy — used below to await the async close()
// path (close() awaits loadGsap() before teardown, so the DOM cleanup lands
// on a later microtask/tick, never synchronously). Same technique
// test/blocks/footer-glow.test.js already uses for its own async assertions.
const waitFor = async (check, { timeout = 2000, interval = 10 } = {}) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, interval); });
  }
  throw new Error('waitFor: condition never became true');
};

// Row shape: head row (heading), then one row per quote with
// category / quote / attribution cells.
const build = (slides) => {
  const el = document.createElement('div');
  el.className = 'quote-interactive';
  const head = document.createElement('div');
  head.innerHTML = '<h2>Customer quotes</h2>';
  el.append(head);
  slides.forEach(([cat, quote, attr]) => {
    const row = document.createElement('div');
    [cat, quote, attr].forEach((text) => {
      const cell = document.createElement('div');
      cell.textContent = text;
      row.append(cell);
    });
    el.append(row);
  });
  document.body.append(el);
  return el;
};

afterEach(async () => {
  document.body.innerHTML = '';
  await loadArea({ area: document.createElement('div') });
  document.head.querySelectorAll('script[src^="https://cdn.jsdelivr.net/npm/gsap@"]').forEach((script) => script.remove());
  window.gsap = undefined;
  window.ScrollTrigger = undefined;
  sinon.restore();
});

describe('quote-interactive hover signal teardown', () => {
  it('aborting while GSAP is still loading removes the hover card and pointer listener', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const controller = new AbortController();
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el, { signal: controller.signal });
    await Promise.resolve();

    const tabsEl = el.querySelector('.qi-tabs');
    expect(document.querySelector('.qi-hover')).to.exist;

    controller.abort();
    expect(document.querySelector('.qi-hover')).to.not.exist;
    const raf = sinon.spy(window, 'requestAnimationFrame');
    tabsEl.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(raf.called).to.be.false;

    const to = sinon.spy();
    const fromTo = sinon.spy();
    const timeline = {};
    timeline.fromTo = () => timeline;
    window.gsap = {
      registerPlugin: () => {},
      killTweensOf: () => {},
      to,
      fromTo,
      timeline: () => timeline,
    };
    scriptFor(GSAP_URL)?.dispatchEvent(new Event('load'));
    await flush();
    window.ScrollTrigger = {};
    scriptFor(SCROLL_TRIGGER_URL)?.dispatchEvent(new Event('load'));
    await flush();

    el.querySelector('.qi-tab').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(document.querySelector('.qi-hover')).to.not.exist;
    expect(to.called).to.be.false;
    expect(fromTo.called).to.be.false;
  });
});

describe('quote-interactive', () => {
  it('builds one tab and one panel per slide row', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el);
    expect(el.querySelectorAll('.qi-tab')).to.have.length(2);
    expect(el.querySelectorAll('.qi-panel')).to.have.length(2);
  });

  it('activates only the first tab/panel initially', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el);
    const tabs = [...el.querySelectorAll('.qi-tab')];
    const panels = [...el.querySelectorAll('.qi-panel')];
    expect(tabs[0].getAttribute('aria-selected')).to.equal('true');
    expect(panels[0].hasAttribute('hidden')).to.be.false;
    expect(panels[1].hasAttribute('hidden')).to.be.true;
  });

  it('clicking a tab switches the active tab and visible panel', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam'], ['Music', 'Solid', 'Jo']]);
    decorate(el);
    const tabs = [...el.querySelectorAll('.qi-tab')];
    const panels = [...el.querySelectorAll('.qi-panel')];
    tabs[2].click();
    expect(tabs[2].getAttribute('aria-selected')).to.equal('true');
    expect(tabs[0].getAttribute('aria-selected')).to.equal('false');
    expect(panels[2].hasAttribute('hidden')).to.be.false;
    expect(panels[0].hasAttribute('hidden')).to.be.true;
  });

  it('a single-slide block does not throw (no tabs to switch between)', () => {
    const el = build([['Sports', 'Great tool', 'Alex']]);
    expect(() => decorate(el)).to.not.throw();
  });
});

describe('quote-interactive modal — close when shouldAnimate() is false', () => {
  afterEach(() => sinon.restore());

  // Regression for the modal-can-never-close bug: when shouldAnimate() is
  // false, loadGsap() resolves to null and the caller must run its own
  // teardown fallback. Two prior implementations got this wrong — one
  // branched on an async wrapper's synchronous return (always a truthy
  // Promise); the next used a `.then((animated) => !animated && teardown())`
  // check that fired teardown from the microtask before the tween even
  // ticked, wiping the modal invisibly instead of letting it animate out.
  // Both left the modal in an incorrect state.
  it('clicking close actually closes the modal (DOM removed, scroll restored, focus returned) when shouldAnimate() is false', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1); // forces shouldAnimate() false
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el);
    const tabs = [...el.querySelectorAll('.qi-tab')];

    tabs[0].click();
    const modal = document.querySelector('.qi-modal');
    expect(modal, 'modal should have opened').to.exist;
    expect(document.body.style.overflow).to.equal('hidden');

    modal.querySelector('.qi-modal-close').click();

    await waitFor(() => !document.querySelector('.qi-modal'));
    expect(document.body.style.overflow, 'page scroll must be restored').to.equal('');
    expect(document.activeElement, 'focus must return to the trigger tab').to.equal(tabs[0]);
  });
});

describe('quote-interactive modal — cross-instance isolation', () => {
  afterEach(() => sinon.restore());

  // Regression for the module-scope `count` leak: decorating a second,
  // unrelated block instance used to eagerly overwrite the shared `count`
  // variable at decoration time, corrupting a DIFFERENT instance's
  // already-open modal navigation.
  it("decorating a second block instance does not corrupt a first instance's already-open modal nav", async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const elA = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam'], ['Music', 'Solid', 'Jo']]);
    decorate(elA);
    const tabsA = [...elA.querySelectorAll('.qi-tab')];
    tabsA[0].click();

    const modal = document.querySelector('.qi-modal');
    modal.querySelector('.qi-modal-next').click(); // slide 0 -> 1
    modal.querySelector('.qi-modal-next').click(); // slide 1 -> 2 (A's real last slide of 3)

    // A second instance with a DIFFERENT (smaller) slide count decorates
    // while A's modal is still open.
    const elB = build([['Design', 'Nice tool', 'Kim'], ['Ops', 'Handy', 'Lee']]);
    decorate(elB);

    modal.querySelector('.qi-modal-prev').click(); // slide 2 -> 1 (still NOT A's last slide)
    expect(
      modal.querySelector('.qi-modal-next').disabled,
      "must reflect A's own 3-slide count, not B's 2-slide count",
    ).to.be.false;

    modal.querySelector('.qi-modal-close').click();
    await waitFor(() => !document.querySelector('.qi-modal'));
  });

  // Regression for the "clicking a second instance hijacks the first
  // instance's open modal" bug: initModal's open-guard used to check only
  // "is ANY modal open", not "does the open modal belong to the instance
  // being interacted with".
  it("clicking a second instance's tab while a first instance's modal is open opens the second instance's own modal, not the first's", () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const elA = build([['Sports', 'Great tool from A', 'Alex'], ['Film', 'Loved it from A', 'Sam']]);
    const elB = build([['Design', 'Nice tool from B', 'Kim'], ['Ops', 'Handy from B', 'Lee']]);
    decorate(elA);
    decorate(elB);
    const tabsA = [...elA.querySelectorAll('.qi-tab')];
    const tabsB = [...elB.querySelectorAll('.qi-tab')];

    tabsA[0].click();
    expect(document.querySelector('.qi-modal').textContent).to.contain('Great tool from A');

    tabsB[0].click();
    expect(document.querySelectorAll('.qi-modal'), "A's modal must be closed, not left open alongside B's").to.have.length(1);
    const modal = document.querySelector('.qi-modal');
    expect(modal.textContent, "modal must show B's own content").to.contain('Nice tool from B');
    expect(modal.textContent, "must not still show A's content").to.not.contain('Great tool from A');
    expect(modal.querySelectorAll('.qi-modal-slide'), "must reflect B's own 2-slide count").to.have.length(2);

    modal.querySelector('.qi-modal-close').click();
  });

  it('aborting one instance clears modal state so another instance can open its own modal', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const a = new AbortController();
    const b = new AbortController();
    const elA = build([['Sports', 'Great tool from A', 'Alex'], ['Film', 'Loved it from A', 'Sam']]);
    decorate(elA, { signal: a.signal });
    elA.querySelector('.qi-tab').click();
    expect(document.querySelector('.qi-modal').textContent).to.contain('Great tool from A');

    a.abort();
    expect(document.querySelector('.qi-modal')).to.not.exist;
    expect(document.body.style.overflow).to.equal('');

    const elB = build([['Design', 'Nice tool from B', 'Kim'], ['Ops', 'Handy from B', 'Lee']]);
    decorate(elB, { signal: b.signal });
    elB.querySelector('.qi-tab').click();

    const modal = document.querySelector('.qi-modal');
    expect(modal).to.exist;
    expect(modal.textContent).to.contain('Nice tool from B');
    expect(modal.textContent).to.not.contain('Great tool from A');
  });
});

describe('quote-interactive re-decoration idempotency', () => {
  it('double-decorate does not corrupt tab/panel content', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el);
    decorate(el);
    expect(el.querySelectorAll('.qi-tab')).to.have.length(2);
    expect(el.querySelectorAll('.qi-panel')).to.have.length(2);
    expect(el.querySelectorAll('.qi-panel blockquote')).to.have.length(2);
    expect(
      el.querySelector('.qi-panel blockquote blockquote'),
      'a second decoration pass must not nest a blockquote inside another',
    ).to.not.exist;
  });

  it('double-decorate does not leave a second floating hover card for the same block', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el);
    decorate(el);
    expect(document.querySelectorAll('.qi-hover')).to.have.length(1);
  });

  it('two block instances keep independent hover cards until their own signal aborts', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const a = new AbortController();
    const b = new AbortController();
    decorate(build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]), { signal: a.signal });
    decorate(build([['Design', 'Nice tool', 'Kim'], ['Ops', 'Handy', 'Lee']]), { signal: b.signal });
    expect(document.querySelectorAll('.qi-hover')).to.have.length(2);

    a.abort();
    expect(
      document.querySelectorAll('.qi-hover'),
      'aborting one instance must not tear down the other instance',
    ).to.have.length(1);
    b.abort();
    expect(document.querySelectorAll('.qi-hover')).to.have.length(0);
  });

  it('loadArea sweep aborts a detached block signal and removes its hover card', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    setConfig({
      components: ['quote-interactive'], hostnames: [], linkBlocks: [], log: () => {},
    });
    document.body.innerHTML = `<main><div>${build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]).outerHTML}</div></main>`;
    await loadArea();
    expect(document.querySelectorAll('.qi-hover')).to.have.length(1);

    document.querySelector('.quote-interactive').closest('.section').remove();
    expect(document.querySelectorAll('.qi-hover')).to.have.length(1);
    await loadArea({ area: document.createElement('div') });
    expect(document.querySelectorAll('.qi-hover')).to.have.length(0);
  });
});
