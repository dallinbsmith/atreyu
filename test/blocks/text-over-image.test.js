import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/text-over-image/text-over-image.js';

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

// EDS-shaped block: authored as one cell holding a media reference plus text
// (see the block's own "one cell of text plus a media reference" contract).
const block = () => {
  const el = document.createElement('div');
  el.className = 'text-over-image';
  const cell = document.createElement('div');
  cell.innerHTML = `<p>${img}</p><h2>Banner title</h2>`;
  el.append(cell);
  document.body.append(el);
  return el;
};

describe('text-over-image', () => {
  it('wraps the media in a single .toi-media and classifies the title', () => {
    const el = block();
    decorate(el);
    expect(el.querySelectorAll('.toi-media')).to.have.length(1);
    expect(el.querySelector('.toi-title')?.textContent).to.equal('Banner title');
  });

  // Idempotency: two decorate() passes leave exactly one media wrapper. The
  // guardDecorate check makes the second pass a clean no-op; note this block is
  // also self-healing without it (a second pass re-adopts the picture into a
  // fresh .toi-media and removes the emptied old one), so this asserts the
  // idempotent end-state, not a corruption the guard alone prevents.
  it('double-decorate does not wrap the media a second time', () => {
    const el = block();
    decorate(el);
    decorate(el);
    expect(el.querySelectorAll('.toi-media')).to.have.length(1);
    expect(el.querySelectorAll('picture')).to.have.length(1);
  });
});
