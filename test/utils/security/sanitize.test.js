import { expect } from '@esm-bundle/chai';
import { sanitizeMarkup } from '../../../scripts/utils/security/sanitize.js';

describe('sanitizeMarkup', () => {
  it('removes <script> tags entirely', () => {
    const result = sanitizeMarkup('<p>safe</p><script>alert(1)</script>');
    expect(result.querySelector('script')).to.be.null;
    expect(result.querySelector('p').textContent).to.equal('safe');
  });

  it('removes <style> tags', () => {
    const result = sanitizeMarkup('<p>x</p><style>body { color: red; }</style>');
    expect(result.querySelector('style')).to.be.null;
  });

  it('removes <iframe> tags', () => {
    const result = sanitizeMarkup('<p>x</p><iframe src="https://evil.example"></iframe>');
    expect(result.querySelector('iframe')).to.be.null;
  });

  it('removes <object>, <embed>, and <link> tags', () => {
    const result = sanitizeMarkup('<p>x</p><object></object><embed><link rel="stylesheet" href="x.css">');
    expect(result.querySelector('object')).to.be.null;
    expect(result.querySelector('embed')).to.be.null;
    expect(result.querySelector('link')).to.be.null;
  });

  it('strips on* event-handler attributes', () => {
    const result = sanitizeMarkup('<img src="x.png" onerror="alert(1)" onload="alert(2)">');
    const img = result.querySelector('img');
    expect(img.hasAttribute('onerror')).to.be.false;
    expect(img.hasAttribute('onload')).to.be.false;
  });

  it('leaves non-"on"-prefixed attributes untouched', () => {
    const result = sanitizeMarkup('<p class="foo" data-id="1" data-oneline="x">text</p>');
    const p = result.querySelector('p');
    expect(p.getAttribute('class')).to.equal('foo');
    expect(p.getAttribute('data-id')).to.equal('1');
    expect(p.getAttribute('data-oneline')).to.equal('x');
  });

  it('strips a javascript: URL from href', () => {
    const result = sanitizeMarkup('<a href="javascript:alert(1)">click</a>');
    expect(result.querySelector('a').hasAttribute('href')).to.be.false;
  });

  it('strips a javascript: URL from src and formaction', () => {
    const result = sanitizeMarkup(
      '<img src="javascript:alert(1)"><form formaction="javascript:alert(1)"></form>',
    );
    expect(result.querySelector('img').hasAttribute('src')).to.be.false;
    expect(result.querySelector('form').hasAttribute('formaction')).to.be.false;
  });

  it('is case-insensitive when matching the javascript: scheme', () => {
    const result = sanitizeMarkup('<a href="JavaScript:alert(1)">click</a>');
    expect(result.querySelector('a').hasAttribute('href')).to.be.false;
  });

  // Regression case documented in sanitize.js's own comment: browsers strip
  // ASCII tab/newline/CR from a URL scheme before navigating (WHATWG "C0
  // control or space" trimming), so a naive .trim() (leading/trailing only)
  // would miss an embedded control character and let the scheme through.
  it('strips a javascript: URL obfuscated with an embedded tab', () => {
    const result = sanitizeMarkup('<a href="jav\tascript:alert(1)">click</a>');
    expect(result.querySelector('a').hasAttribute('href')).to.be.false;
  });

  it('strips a javascript: URL obfuscated with embedded newline/CR characters', () => {
    const result = sanitizeMarkup('<a href="jav\n\rascript:alert(1)">click</a>');
    expect(result.querySelector('a').hasAttribute('href')).to.be.false;
  });

  it('leaves a normal https href untouched', () => {
    const result = sanitizeMarkup('<a href="https://example.com">click</a>');
    expect(result.querySelector('a').getAttribute('href')).to.equal('https://example.com');
  });

  it('returns a root from a separate parser document — caller must move children into the live DOM explicitly', () => {
    // Not asserting `.isConnected` here — that's true for any parsed
    // document's own <body> (it's connected within ITS OWN document tree),
    // which isn't the security property that matters. What matters, and
    // what this asserts, is that the result belongs to a different document
    // than the live page — so nothing in it can execute (event handlers,
    // navigation) until a caller explicitly moves it into `document`.
    const result = sanitizeMarkup('<p>x</p>');
    expect(result.ownerDocument).to.not.equal(document);
  });
});
