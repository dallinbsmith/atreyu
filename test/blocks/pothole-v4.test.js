import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/pothole-v4/pothole-v4.js';

const block = (classes, rowsHtml) => {
  const el = document.createElement('div');
  el.className = `pothole-v4 ${classes}`.trim();
  rowsHtml.forEach((html) => {
    const row = document.createElement('div');
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
    el.append(row);
  });
  document.body.append(el);
  return el;
};

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

describe('pothole-v4', () => {
  it('moves the background media into .pothole-background', () => {
    const el = block('', [img, '<h2>Title</h2>']);
    decorate(el);
    expect(el.querySelector('.pothole-background picture')).to.exist;
  });

  it('a bare numeric trailing row sets --media-scale and is removed from content', () => {
    const el = block('', [img, '<h2>Title</h2>', '1.2']);
    decorate(el);
    expect(el.style.getPropertyValue('--media-scale')).to.equal('1.2');
    expect(el.querySelectorAll(':scope > div')).to.have.length(2);
  });

  it('a bare glow-color trailing row adds a glow-{color} class', () => {
    const el = block('', [img, '<h2>Title</h2>', 'purple']);
    decorate(el);
    expect(el.classList.contains('glow-purple')).to.be.true;
    expect(el.querySelector('.pothole-content')?.textContent).to.not.include('purple');
  });

  it('an unrecognized trailing row is left as ordinary content, not consumed as metadata', () => {
    const el = block('', [img, '<h2>Title</h2><p>not metadata</p>']);
    decorate(el);
    expect(el.querySelector('.pothole-content').textContent).to.include('not metadata');
  });

  it('preserves author-set variant classes (e.g. right-aligned)', () => {
    const el = block('right-aligned overflow', [img, '<h2>Title</h2>']);
    decorate(el);
    expect(el.classList.contains('right-aligned')).to.be.true;
    expect(el.classList.contains('overflow')).to.be.true;
  });

  it('classes CTA links as .btn with primary/secondary ordering', () => {
    const el = block('', [img, '<p><a href="/a">A</a></p><p><a href="/b">B</a></p>']);
    decorate(el);
    const links = el.querySelectorAll('.pothole-content a');
    expect(links[0].classList.contains('btn-primary')).to.be.true;
    expect(links[1].classList.contains('btn-secondary')).to.be.true;
  });
});
