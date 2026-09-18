import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { loadStyle } from '../../scripts/ak.js';
import decorate from '../../blocks/standout-mosaic/standout-mosaic.js';

// scroll.js's trackScrollProgress looks up the global `IntersectionObserver`
// at call-time (not an imported binding), so swapping the constructor for a
// fake that captures its target/options lets a test assert deterministically
// on whether the scroll tracker was wired. Pattern matches
// image-sequence.test.js / pothole.test.js. Restored in afterEach.
class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target) { this.target = target; }

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

const TINY = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const pic = () => `<picture><img src="${TINY}"></picture>`;
const videoPic = () => `<a href="https://example.com/ui.mp4">${pic()}</a>`;

// EDS-shaped block: `rows` is an array of rows, each row an array of cell HTML
// strings (sibling columns). Mirrors the real document authoring shape.
const build = (rows) => {
  const el = document.createElement('div');
  el.className = 'standout-mosaic';
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((html) => {
      const cell = document.createElement('div');
      cell.innerHTML = html;
      row.append(cell);
    });
    el.append(row);
  });
  document.body.append(el);
  return el;
};

// Standard shape: title row, lone device row, then N card pictures grouped
// multi-per-row so the device (a lone-picture row) is distinguishable.
const standard = ({ cards = 8, device = pic(), title = '<h2>Standout</h2>' } = {}) => {
  const rows = [];
  if (title) rows.push([title]);
  if (device) rows.push([device]);
  const cardCells = [...Array(cards)].map(() => pic());
  for (let i = 0; i < cardCells.length; i += 4) rows.push(cardCells.slice(i, i + 4));
  return build(rows);
};

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

describe('standout-mosaic', () => {
  let originalIO;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    window.IntersectionObserver = FakeIntersectionObserver;
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    sinon.restore();
    document.body.innerHTML = '';
  });

  it('builds title, device, and 8 cards in 4 columns with FLAT continuous testids', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard();
    decorate(el);

    expect(el.querySelector('.standout-mosaic-title h2')).to.exist;
    expect(el.querySelector('.standout-mosaic-device picture')).to.exist;
    const columns = el.querySelectorAll('.standout-mosaic-column');
    expect(columns).to.have.length(4);
    columns.forEach((c) => expect(c.querySelectorAll('.standout-mosaic-card')).to.have.length(2));

    const testids = [...el.querySelectorAll('.standout-mosaic-card')].map((c) => c.dataset.testid);
    expect(testids).to.deep.equal([...Array(8)].map((_, i) => `standout-mosaic-card-${i}`));
  });

  it('card pictures are marked decorative (alt === "")', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard();
    decorate(el);
    const imgs = [...el.querySelectorAll('.standout-mosaic-card img')];
    expect(imgs).to.have.length(8);
    imgs.forEach((img) => expect(img.alt).to.equal(''));
  });

  it('warns when pictures exist but no device is detected and card count is odd', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const warn = sinon.stub(console, 'warn');
    // No lone-media row and no video: 9 pictures all grouped → no device, count
    // 9 is not a clean multiple of 2 → the misauthoring warning fires.
    const nine = [...Array(9)].map(() => pic());
    const el = build([['<h2>T</h2>'], nine]);
    decorate(el);
    expect(warn.calledOnce).to.be.true;
    expect(warn.firstCall.args[0]).to.contain('standout-mosaic');
  });

  it('does NOT warn on a clean 8-card + device authoring', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const warn = sinon.stub(console, 'warn');
    decorate(standard());
    expect(warn.called).to.be.false;
  });

  it('animating branch: scroll tracker observes the block (one IO on el)', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard();
    decorate(el);
    expect(FakeIntersectionObserver.instances).to.have.length(1);
    expect(FakeIntersectionObserver.instances[0].target).to.equal(el);
  });

  it('double-decorate is a no-op (guard) — no second IO, no duplicated cards', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard();
    decorate(el);
    decorate(el);
    expect(FakeIntersectionObserver.instances).to.have.length(1);
    expect(el.querySelectorAll('.standout-mosaic-card')).to.have.length(8);
  });

  it('static / reduced-motion branch: no observer created, mosaic fully rendered', async () => {
    await loadStyle('/blocks/standout-mosaic/standout-mosaic.css');
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = standard();
    decorate(el);
    expect(FakeIntersectionObserver.instances).to.have.length(0);
    expect(el.querySelectorAll('.standout-mosaic-column')).to.have.length(4);
    expect(el.querySelectorAll('.standout-mosaic-card')).to.have.length(8);
    expect(el.querySelector('.standout-mosaic-title')).to.exist;

    // Valid resting frame: with --progress unset (default 0) the title is fully
    // visible and un-displaced — no partial parallax leaking into the rest state.
    const cs = getComputedStyle(el.querySelector('.standout-mosaic-title'));
    expect(cs.opacity).to.equal('1');
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).to.include(cs.transform);
  });

  it('edge: 6 cards → 3 columns of 2, no crash', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard({ cards: 6 });
    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelectorAll('.standout-mosaic-column')).to.have.length(3);
    expect(el.querySelectorAll('.standout-mosaic-card')).to.have.length(6);
  });

  it('edge: 7 cards → trailing odd card forms a short 4th column', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard({ cards: 7 });
    decorate(el);
    const columns = el.querySelectorAll('.standout-mosaic-column');
    expect(columns).to.have.length(4);
    expect(columns[3].querySelectorAll('.standout-mosaic-card')).to.have.length(1);
    const testids = [...el.querySelectorAll('.standout-mosaic-card')].map((c) => c.dataset.testid);
    expect(testids.at(-1)).to.equal('standout-mosaic-card-6');
  });

  it('edge: missing device (all pictures grouped) → no device, all become cards', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = build([['<h2>T</h2>'], [pic(), pic(), pic(), pic(), pic(), pic(), pic(), pic()]]);
    decorate(el);
    expect(el.querySelector('.standout-mosaic-device')).to.not.exist;
    expect(el.querySelectorAll('.standout-mosaic-card')).to.have.length(8);
  });

  it('edge: missing title → renders mosaic without a title lockup', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard({ title: null });
    decorate(el);
    expect(el.querySelector('.standout-mosaic-title')).to.not.exist;
    expect(el.querySelector('.standout-mosaic-device')).to.exist;
    expect(el.querySelectorAll('.standout-mosaic-card')).to.have.length(8);
  });

  it('image device: no <video> element created', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard();
    decorate(el);
    expect(el.querySelector('.standout-mosaic-device video')).to.not.exist;
    expect(el.querySelector('.standout-mosaic-device picture')).to.exist;
  });

  it('video device (animating): autoplay-muted-loop video + awaited WCAG pause control', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = standard({ device: videoPic() });
    decorate(el);
    const video = el.querySelector('.standout-mosaic-device video');
    expect(video).to.exist;
    expect(video.muted).to.be.true;
    expect(video.loop).to.be.true;
    expect(video.hasAttribute('autoplay')).to.be.false; // played via .play(), not the attribute
    const button = await waitFor(() => el.querySelector('.standout-mosaic-device .video-pause-toggle'));
    expect(button.getAttribute('aria-pressed')).to.equal('false');
  });

  it('video device (reduced-motion): stays a static picture, no video, no observer', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = standard({ device: videoPic() });
    decorate(el);
    expect(el.querySelector('.standout-mosaic-device video')).to.not.exist;
    expect(el.querySelector('.standout-mosaic-device picture')).to.exist;
    expect(FakeIntersectionObserver.instances).to.have.length(0);
  });

  // Real render: DESKTOP parallax must actually respond to --progress; MOBILE
  // (< md) must stay static. See DoD "did you render it".
  describe('real render', () => {
    const getSheet = () => [...document.styleSheets]
      .find((s) => (s.href ?? '').endsWith('standout-mosaic.css'));

    // Collect transform declarations that reference --progress, tagged with
    // whether they live inside a >= 768px media block.
    // A nested style rule exposes BOTH its own .style and a (possibly empty)
    // .cssRules for its nested children — so read the transform AND recurse,
    // rather than treating "has cssRules" as mutually exclusive.
    const collectProgressTransforms = (rules, inMd, out) => {
      [...rules].forEach((rule) => {
        if (rule.style?.transform?.includes('var(--progress')) {
          out.push({ selector: rule.selectorText, inMd });
        }
        if (rule.cssRules?.length) {
          const cond = rule.media?.mediaText ?? rule.conditionText ?? '';
          collectProgressTransforms(rule.cssRules, inMd || cond.includes('768'), out);
        }
      });
    };

    it('desktop: title/device/column/card transforms differ between --progress 0 and 1', async () => {
      await loadStyle('/blocks/standout-mosaic/standout-mosaic.css');
      expect(window.matchMedia('(min-width: 768px)').matches, 'runner viewport must be >= md').to.be.true;
      sinon.stub(navigator, 'hardwareConcurrency').value(8);
      const el = standard();
      decorate(el);

      const targets = {
        title: el.querySelector('.standout-mosaic-title'),
        device: el.querySelector('.standout-mosaic-device'),
        column: el.querySelectorAll('.standout-mosaic-column')[1], // col 0 offset is 0
        card: el.querySelector('[data-testid="standout-mosaic-card-1"]'), // 2nd card, index 1
      };
      const snap = () => Object.fromEntries(Object.entries(targets).map(([k, node]) => {
        const cs = getComputedStyle(node);
        return [k, `${cs.transform}|${cs.opacity}`];
      }));

      el.style.setProperty('--progress', '0');
      const at0 = snap();
      el.style.setProperty('--progress', '1');
      const at1 = snap();

      Object.keys(targets).forEach((k) => expect(at0[k], `${k} should react to --progress`).to.not.equal(at1[k]));
    });

    it('mobile: every --progress transform is gated behind a >= 768px media block', async () => {
      await loadStyle('/blocks/standout-mosaic/standout-mosaic.css');
      const sheet = getSheet();
      expect(sheet, 'stylesheet loaded').to.exist;
      const found = [];
      collectProgressTransforms(sheet.cssRules, false, found);
      expect(found.length, 'parallax transforms exist').to.be.greaterThan(0);
      found.forEach((r) => expect(r.inMd, `${r.selector} must be desktop-gated`).to.be.true);
    });
  });
});
