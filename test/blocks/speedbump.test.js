import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/speedbump/speedbump.js';

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'speedbump';
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

describe('speedbump', () => {
  it('classifies the row with a picture as media and the rest as content', () => {
    const el = block([[img], ['<h2>Title</h2><p>Body copy</p>']]);
    decorate(el);
    expect(el.querySelector('.speedbump-media picture')).to.exist;
    expect(el.querySelector('.speedbump-title')?.textContent).to.equal('Title');
    expect(el.querySelector('.speedbump-content').textContent).to.include('Body copy');
  });

  // F-66: a picture cell with a sibling text cell IN THE SAME ROW must not
  // sweep that sibling into the media wrapper — the recurring bug class this
  // project has hit three times in other blocks. getCells flattens rows
  // before classification, so this must stay correct across refactors.
  it('a picture cell with a sibling text cell in the same row keeps the text in content', () => {
    const el = block([[img, '<h2>Title</h2><p>Caption</p>']]);
    decorate(el);
    expect(el.querySelector('.speedbump-media picture')).to.exist;
    expect(el.querySelector('.speedbump-content').textContent).to.include('Caption');
    expect(el.querySelector('.speedbump-media').textContent).to.not.include('Caption');
  });

  it('single content row (no media) does not throw and has no .speedbump-media', () => {
    const el = block([['<h2>Just text</h2>']]);
    decorate(el); // Mocha fails the test if this throws
    expect(el.querySelector('.speedbump-media')).to.not.exist;
    expect(el.querySelector('.speedbump-title')).to.exist;
  });

  it('an empty block does not throw', () => {
    const el = document.createElement('div');
    el.className = 'speedbump';
    document.body.append(el);
    decorate(el); // Mocha fails the test if this throws
  });

  // Falkor's real extraction rule: exactly one link in the content promotes
  // the WHOLE card to a link, and the link's own text stays visible as plain
  // text rather than a second, separately-clickable element.
  it('exactly one link in the content promotes the whole card to an <a>, unwrapping the original link', () => {
    const el = block([[img], ['<h2>Title</h2><p><a href="/learn-more">Learn more</a></p>']]);
    decorate(el);
    const card = el.querySelector('.speedbump-card');
    expect(card.tagName).to.equal('A');
    expect(card.getAttribute('href')).to.equal('/learn-more');
    expect(card.querySelectorAll('a')).to.have.length(0);
    expect(card.textContent).to.include('Learn more');
  });

  it('two links in the content are left as plain inline links, not promoted to a whole-card link', () => {
    const el = block([[img], ['<h2>Title</h2><p><a href="/one">One</a> <a href="/two">Two</a></p>']]);
    decorate(el);
    const card = el.querySelector('.speedbump-card');
    expect(card.tagName).to.equal('DIV');
    expect(card.querySelectorAll('a')).to.have.length(2);
  });

  it('no link in the content leaves the card as a non-interactive div', () => {
    const el = block([[img], ['<h2>Title</h2><p>Body copy</p>']]);
    decorate(el);
    expect(el.querySelector('.speedbump-card').tagName).to.equal('DIV');
  });

  // A single link with an empty or missing href must not be silently deleted —
  // unwrapping and promotion are both decided from the same cardHref value, so
  // a falsy href leaves the link inline (not promoted, not destroyed) instead
  // of unwrapping unconditionally while only promoting when truthy.
  it('a single link with an empty href is left inline, not unwrapped and not promoted', () => {
    const el = block([[img], ['<h2>Title</h2><p><a href="">Nowhere</a></p>']]);
    decorate(el);
    const card = el.querySelector('.speedbump-card');
    expect(card.tagName).to.equal('DIV');
    expect(card.querySelector('a'), 'the link must still exist, not be unwrapped away').to.exist;
    expect(card.textContent).to.include('Nowhere');
  });

  it('a single link with no href attribute at all is left inline, not unwrapped and not promoted', () => {
    const el = block([[img], ['<h2>Title</h2><p><a>Nowhere</a></p>']]);
    decorate(el);
    const card = el.querySelector('.speedbump-card');
    expect(card.tagName).to.equal('DIV');
    expect(card.querySelector('a')).to.exist;
  });

  // Decorative once text is laid over it — same convention as pothole.js.
  it('nulls the background image alt text (decorative once text is overlaid)', () => {
    const withAlt = img.replace('<img ', '<img alt="A meaningful photo" ');
    const el = block([[withAlt], ['<h2>Title</h2>']]);
    decorate(el);
    expect(el.querySelector('.speedbump-media img').getAttribute('alt')).to.equal('');
  });

  it('double-decorate does not corrupt content (re-entrancy guard)', () => {
    const el = block([[img], ['<h2>Title</h2><p><a href="/a">Go</a></p>']]);
    decorate(el);
    decorate(el);
    expect(el.querySelectorAll('.speedbump-card')).to.have.length(1);
    expect(el.querySelectorAll('.speedbump-media')).to.have.length(1);
    expect(el.querySelector('.speedbump-card').getAttribute('href')).to.equal('/a');
  });
});
