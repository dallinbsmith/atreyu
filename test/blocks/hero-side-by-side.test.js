import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/hero-side-by-side/hero-side-by-side.js';

// decorateVideoMedia's pause toggle is fire-and-forget (see the LCP-regression
// note in scripts/utils/media.js) — a test that needs it has no choice but to
// poll for it, same pattern used in test/utils/media.test.js.
const waitFor = async (check, { timeout = 2000, interval = 10 } = {}) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => { setTimeout(resolve, interval); });
  }
  throw new Error('waitFor: condition never became true');
};

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'hero-side-by-side';
  rowsHtml.forEach((cellsHtml) => {
    const row = document.createElement('div');
    cellsHtml.forEach((html) => {
      const cell = document.createElement('div');
      cell.innerHTML = html;
      row.append(cell);
    });
    el.append(row);
  });
  document.body.append(el);
  return el;
};

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

describe('hero-side-by-side', () => {
  afterEach(() => sinon.restore());

  it('classifies the row with a picture as media regardless of position', () => {
    const el = block([[img], ['<h1>Title</h1>']]);
    decorate(el);
    expect(el.querySelector('.hero-side-by-side-media picture')).to.exist;
    expect(el.querySelector('.hero-side-by-side-content h1')).to.exist;
  });

  it('single content row (no media) adds no-media and does not throw', () => {
    const el = block([['<h1>Just text</h1>']]);
    decorate(el); // Mocha fails the test if this throws
    expect(el.querySelector('.hero-side-by-side-media')).to.not.exist;
    expect(el.classList.contains('no-media')).to.be.true;
    expect(el.querySelector('.hero-side-by-side-content h1')).to.exist;
  });

  it('an unexpected extra content row is merged into content, not misread as media', () => {
    const el = block([[img], ['<h1>Real title</h1>'], ['<p>Extra authored row</p>']]);
    decorate(el);
    const content = el.querySelector('.hero-side-by-side-content');
    expect(content.textContent).to.include('Real title');
    expect(content.textContent).to.include('Extra authored row');
    expect(el.querySelectorAll('.hero-side-by-side-media').length).to.equal(1);
    expect(el.querySelector('.hero-side-by-side-media picture')).to.exist;
  });

  it('an empty block does not throw', () => {
    const el = document.createElement('div');
    el.className = 'hero-side-by-side';
    document.body.append(el);
    decorate(el); // Mocha fails the test if this throws
    expect(el.classList.contains('no-media')).to.be.true;
    expect(el.classList.contains('no-text')).to.be.true;
  });

  it('a media-only row (no real text) adds no-text and does not append an empty content div', () => {
    const el = block([[img]]);
    decorate(el);
    expect(el.classList.contains('no-text')).to.be.true;
    expect(el.querySelector('.hero-side-by-side-content')).to.not.exist;
    expect(el.querySelector('.hero-side-by-side-media picture')).to.exist;
  });

  it('classifies a CTA paragraph (contains a link) with .hero-side-by-side-cta instead of relying on a structural selector', () => {
    const el = block([[img], ['<h1>Title</h1><p>Body copy</p><p><a href="/a">Go</a></p>']]);
    decorate(el);
    const ctaPara = el.querySelector('.hero-side-by-side-cta');
    expect(ctaPara).to.exist;
    expect(ctaPara.tagName).to.equal('P');
    expect(ctaPara.querySelector('a')).to.exist;
    expect(el.querySelector('.hero-side-by-side-content p:not(.hero-side-by-side-cta)').textContent).to.equal('Body copy');
  });

  it('wires a Wistia link in the content to open the video modal instead of navigating', () => {
    const el = block([[img], ['<p><a href="https://frameio.wistia.com/medias/abc123">Watch Overview</a></p>']]);
    decorate(el);
    const link = el.querySelector('a');
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(evt);
    expect(evt.defaultPrevented).to.be.true;
  });

  it('double-decorate does not attach a second click listener to the video link', () => {
    const wistiaHtml = '<p><a href="https://frameio.wistia.com/medias/abc123">Watch</a></p>';
    const el = block([[img], [wistiaHtml]]);
    decorate(el);
    const link = el.querySelector('a');
    const addSpy = sinon.spy(link, 'addEventListener');
    decorate(el); // second call must be a no-op due to the idempotency guard
    expect(addSpy.callCount).to.equal(0);
    expect(el.querySelectorAll('.hero-side-by-side-content').length).to.equal(1);
  });

  // Regression for the traced re-decoration bug (DA live-preview reload path):
  // a double-decorate landing in the async window before the background
  // video's `canplay` fires used to build a second, live media div while the
  // first decorateVideoMedia() call's in-flight addVideoPauseControl()
  // promise still resolved against the now-detached original div — the
  // pause/play toggle got built but silently never rendered anywhere in the
  // live DOM (WCAG 2.2.2 regression). With the idempotency guard, the second
  // decorate() call is a no-op, so exactly one video and one toggle end up
  // live under `el`.
  it('double-decorate before canplay leaves exactly one live video and pause toggle (no orphaned media div)', async () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const videoImg = '<a href="/media/clip.mp4">'
      + '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>'
      + '</a>';
    const el = block([[videoImg], ['<h1>Title</h1>']]);
    decorate(el);
    decorate(el); // lands in the async placeholder-fetch window, before canplay

    const toggle = await waitFor(() => el.querySelector('.video-pause-toggle'));
    expect(toggle.isConnected).to.be.true;
    expect(el.querySelectorAll('.video-pause-toggle').length).to.equal(1);
    expect(el.querySelectorAll('.hero-side-by-side-media').length).to.equal(1);
    expect(el.querySelectorAll('video').length).to.equal(1);
    expect(el.querySelector('video').isConnected).to.be.true;
  });
});
