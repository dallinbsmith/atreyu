import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/hero-calendly/hero-calendly.js';

// getPlaceholder (placeholders.json) hits the real (404-ing) test server and
// gracefully falls back to its English default — same pattern relied on by
// logo-wall.test.js/form.test.js, no fetch stubbing needed here.
const FALLBACK_TEXT = 'This scheduling widget is not available right now.';
const WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js';

const block = ({ variant = '', href = 'https://calendly.com/frameio/demo' } = {}) => {
  const el = document.createElement('div');
  el.className = ['hero-calendly', variant].filter(Boolean).join(' ');
  const row = document.createElement('div');
  const textCell = document.createElement('div');
  textCell.innerHTML = '<h2>Book time with us</h2><p>Pick a slot that works.</p>';
  const linkCell = document.createElement('div');
  if (href) linkCell.innerHTML = `<a href="${href}">Schedule</a>`;
  row.append(textCell, linkCell);
  el.append(row);
  document.body.append(el);
  return el;
};

describe('hero-calendly', () => {
  afterEach(() => {
    document.querySelectorAll('.hero-calendly').forEach((el) => el.remove());
    document.querySelector(`head > script[src="${WIDGET_SRC}"]`)?.remove();
    delete window.Calendly;
  });

  it('shows the fallback and never touches window.Calendly when no link is authored', async () => {
    const el = block({ href: null });
    window.Calendly = { initInlineWidget: () => { throw new Error('should not be called'); } };
    await decorate(el);

    expect(el.querySelector('.hero-calendly-widget').textContent).to.equal(FALLBACK_TEXT);
  });

  it('rejects a spoofed href that merely contains "calendly.com" as a substring', async () => {
    // Matches the loose candidate-selector (`[href*="calendly.com"]`) but
    // fails isAllowedEmbedHost's real hostname check — proves the security
    // gate, not the candidate-selection heuristic, is what actually decides.
    const el = block({ href: 'https://evil.example.com/?redirect=calendly.com' });
    window.Calendly = { initInlineWidget: () => { throw new Error('should not be called'); } };
    await decorate(el);

    expect(el.querySelector('.hero-calendly-widget').textContent).to.equal(FALLBACK_TEXT);
  });

  it('rejects a lookalike host', async () => {
    const el = block({ href: 'https://calendly.com.evil.example.com/x' });
    window.Calendly = { initInlineWidget: () => { throw new Error('should not be called'); } };
    await decorate(el);

    expect(el.querySelector('.hero-calendly-widget').textContent).to.equal(FALLBACK_TEXT);
  });

  it('initializes the inline widget for a real calendly.com link, with dark theme by default', async () => {
    // Pre-insert the script tag so loadScript's existing-tag branch resolves
    // immediately (null) instead of making a real network request in tests.
    const tag = document.createElement('script');
    tag.src = WIDGET_SRC;
    document.head.append(tag);

    let calledWith;
    window.Calendly = { initInlineWidget: (opts) => { calledWith = opts; } };

    const el = block({ href: 'https://calendly.com/frameio/demo' });
    await decorate(el);

    expect(calledWith).to.exist;
    const url = new URL(calledWith.url);
    expect(url.hostname).to.equal('calendly.com');
    expect(url.searchParams.get('background_color')).to.equal('000000');
    expect(url.searchParams.get('text_color')).to.equal('fcfcfc');
    expect(url.searchParams.get('primary_color')).to.equal('5b53ff');
    expect(calledWith.parentElement).to.equal(el.querySelector('.hero-calendly-widget'));
  });

  it('flips theme colors for the light variant', async () => {
    const tag = document.createElement('script');
    tag.src = WIDGET_SRC;
    document.head.append(tag);

    let calledWith;
    window.Calendly = { initInlineWidget: (opts) => { calledWith = opts; } };

    const el = block({ variant: 'light', href: 'https://calendly.com/frameio/demo' });
    await decorate(el);

    const url = new URL(calledWith.url);
    expect(url.searchParams.get('background_color')).to.equal('fcfcfc');
    expect(url.searchParams.get('text_color')).to.equal('000000');
  });

  it('is idempotent — a second decorate() call on an already-decorated block is a no-op', async () => {
    const tag = document.createElement('script');
    tag.src = WIDGET_SRC;
    document.head.append(tag);

    let callCount = 0;
    window.Calendly = { initInlineWidget: () => { callCount += 1; } };

    const el = block({ href: 'https://calendly.com/frameio/demo' });
    await decorate(el);
    await decorate(el);

    expect(callCount).to.equal(1);
  });
});
