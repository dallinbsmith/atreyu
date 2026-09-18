import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/floating-action-button/floating-action-button.js';

const WISTIA = 'https://fast.wistia.net/embed/iframe/abc123';

// Authoring shape: a block with a label cell and a Wistia link cell (Falkor's
// schema is a required label string + a required Wistia video). Each string is
// its own cell (sibling div under the row), mirroring the real EDS shape.
const block = (cellsHtml) => {
  const el = document.createElement('div');
  el.className = 'floating-action-button';
  const row = document.createElement('div');
  cellsHtml.forEach((html) => {
    const c = document.createElement('div');
    c.innerHTML = html;
    row.append(c);
  });
  el.append(row);
  document.body.append(el);
  return el;
};

const link = (href = WISTIA, text = 'Watch') => `<a href="${href}">${text}</a>`;

// Close any open modal + reset the video-modal module singleton between tests,
// and drop stray FAB nodes. openVideoModal early-returns while a modal is open.
afterEach(() => {
  document.querySelector('.video-modal-close')?.click();
  document.querySelectorAll('.video-modal, .floating-action-button').forEach((n) => n.remove());
  document.body.style.overflow = '';
  sinon.restore();
});

describe('floating-action-button', () => {
  it('renders a floating <button> whose accessible name is the authored label', () => {
    // hardwareConcurrency 1 -> shouldAnimate() false: assert the static
    // resting DOM is a present, usable button (no motion class).
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block(['Watch the demo', link(WISTIA, '')]);
    decorate(el);
    const button = el.querySelector('.fab-button');
    expect(button).to.exist;
    expect(button.tagName).to.equal('BUTTON');
    expect(button.type).to.equal('button');
    expect(button.textContent.trim()).to.equal('Watch the demo');
    expect(el.classList.contains('fab-animate')).to.be.false;
  });

  it('clicking the button opens the video modal with the correct Wistia id', () => {
    const el = block(['Watch the demo', link(WISTIA, '')]);
    decorate(el);
    el.querySelector('.fab-button').click();
    const modal = document.querySelector('.video-modal');
    expect(modal).to.exist;
    expect(modal.querySelector('iframe').src).to.include('abc123');
  });

  it('passes the label as the modal accessible name (title)', () => {
    const el = block(['Watch the demo', link(WISTIA, '')]);
    decorate(el);
    el.querySelector('.fab-button').click();
    expect(document.querySelector('.video-modal').getAttribute('aria-label')).to.equal('Watch the demo');
  });

  it('returns focus to the button when the modal closes (shared util behavior)', () => {
    const el = block(['Watch the demo', link(WISTIA, '')]);
    decorate(el);
    const button = el.querySelector('.fab-button');
    button.click();
    document.querySelector('.video-modal-close').click();
    expect(document.activeElement).to.equal(button);
  });

  it('the play icon is decorative (aria-hidden) — the label carries the name', () => {
    const el = block(['Watch the demo', link(WISTIA, '')]);
    decorate(el);
    expect(el.querySelector('.fab-icon').getAttribute('aria-hidden')).to.equal('true');
    expect(el.querySelector('.fab-button').getAttribute('aria-label')).to.be.null;
  });

  it('falls back to the link text when there is no separate label cell', () => {
    const el = block([link(WISTIA, 'Play the tour')]);
    decorate(el);
    expect(el.querySelector('.fab-label').textContent).to.equal('Play the tour');
  });

  it('classifies by content shape, not position — empty leading/trailing cells with the label BEFORE the link', () => {
    // Recurring bug class: a naive positional read (first cell / cell next to
    // the link) breaks when authors leave empty cells around the real content.
    const el = block(['', 'Watch the demo', link(WISTIA, ''), '']);
    decorate(el);
    const button = el.querySelector('.fab-button');
    expect(button.textContent.trim()).to.equal('Watch the demo');
    button.click();
    expect(document.querySelector('.video-modal').querySelector('iframe').src).to.include('abc123');
  });

  it('motion on (shouldAnimate() true) adds the appear class but the button stays usable', () => {
    // hardwareConcurrency >= 4 with default no-preference reduced-motion ->
    // shouldAnimate() true. The class only drives a CSS entrance animation;
    // the button is present and clickable regardless.
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = block(['Watch the demo', link(WISTIA, '')]);
    decorate(el);
    expect(el.classList.contains('fab-animate')).to.be.true;
    el.querySelector('.fab-button').click();
    expect(document.querySelector('.video-modal')).to.exist;
  });

  it('no Wistia link -> fail safe, renders nothing (no dead button)', () => {
    const el = block(['Watch the demo', '<a href="https://example.com/nope">x</a>']);
    decorate(el);
    expect(el.querySelector('.fab-button')).to.not.exist;
    expect(el.children).to.have.length(0);
  });

  it('a Wistia link but no usable label -> fail safe (no unnamed button)', () => {
    const el = block([link(WISTIA, '')]);
    decorate(el);
    expect(el.querySelector('.fab-button')).to.not.exist;
  });

  it('is idempotent — a second decorate() is a no-op (guardDecorate)', () => {
    const el = block(['Watch the demo', link(WISTIA, '')]);
    decorate(el);
    const first = el.querySelector('.fab-button');
    decorate(el);
    expect(el.querySelector('.fab-button')).to.equal(first);
    expect(el.querySelectorAll('.fab-button')).to.have.length(1);
  });
});
