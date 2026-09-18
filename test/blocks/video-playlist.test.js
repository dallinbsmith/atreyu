import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/video-playlist/video-playlist.js';

const picture = (src = 'poster.jpg') => `<picture><img src="${src}" alt="poster"></picture>`;
const wistia = (id) => `<a href="https://fast.wistia.net/embed/iframe/${id}">Watch</a>`;

// One authored row per video item; four cells (poster / title / subtitle /
// Wistia link). Any cell can be omitted to exercise an edge shape.
const itemRow = ({
  poster = picture(), title = 'Title', subtitle = 'Sub', id = 'abc123',
} = {}) => {
  const cells = [];
  if (poster !== null) cells.push(poster);
  if (title !== null) cells.push(`<h3>${title}</h3>`);
  if (subtitle !== null) cells.push(`<p>${subtitle}</p>`);
  if (id !== null) cells.push(wistia(id));
  return `<div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`;
};

const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'video-playlist';
  el.innerHTML = rows.join('');
  document.body.append(el);
  return el;
};

const closeModal = () => document.querySelector('.video-modal-close')?.click();

describe('video-playlist', () => {
  afterEach(() => {
    closeModal();
    document.querySelectorAll('.video-playlist, .video-modal').forEach((n) => n.remove());
  });

  it('renders the first item as the featured card and the rest as a list', async () => {
    const el = block([
      itemRow({ title: 'One', subtitle: 'Ep 1', id: 'v1' }),
      itemRow({ title: 'Two', subtitle: 'Ep 2', id: 'v2' }),
      itemRow({ title: 'Three', subtitle: 'Ep 3', id: 'v3' }),
    ]);
    await decorate(el);

    const featured = el.querySelector('.video-playlist-featured');
    expect(featured).to.exist;
    expect(featured.querySelector('.video-playlist-poster img')).to.exist;
    expect(featured.querySelector('.video-playlist-title').textContent).to.equal('One');
    expect(featured.querySelector('.video-playlist-subtitle').textContent).to.equal('Ep 1');

    const listItems = [...el.querySelectorAll('.video-playlist-item')];
    expect(listItems).to.have.length(2);
    expect(listItems[0].querySelector('.video-playlist-title').textContent).to.equal('Two');
    expect(listItems[0].querySelector('.video-playlist-poster img')).to.exist;
    expect(listItems[1].querySelector('.video-playlist-subtitle').textContent).to.equal('Ep 3');
  });

  it('opens the modal for the FEATURED item with that item\'s Wistia id', async () => {
    const el = block([
      itemRow({ id: 'FEAT001' }),
      itemRow({ id: 'LIST002' }),
    ]);
    await decorate(el);

    el.querySelector('.video-playlist-featured').click();
    const iframe = document.querySelector('.video-modal-iframe');
    expect(iframe).to.exist;
    expect(iframe.src).to.include('FEAT001');
    expect(iframe.src).to.not.include('LIST002');
  });

  it('opens the modal for a LIST item with THAT item\'s id (catches index bugs)', async () => {
    const el = block([
      itemRow({ id: 'FEAT001' }),
      itemRow({ id: 'LIST002' }),
    ]);
    await decorate(el);

    el.querySelector('.video-playlist-item .video-playlist-thumb').click();
    const iframe = document.querySelector('.video-modal-iframe');
    expect(iframe).to.exist;
    expect(iframe.src).to.include('LIST002');
    expect(iframe.src).to.not.include('FEAT001');
  });

  it('assigns a per-instance UNIQUE data-testid across every item (no reset/collision)', async () => {
    const el = block([
      itemRow({ id: 'a' }),
      itemRow({ id: 'b' }),
      itemRow({ id: 'c' }),
      itemRow({ id: 'd' }),
    ]);
    await decorate(el);
    const testids = [...el.querySelectorAll('[data-testid^="video-playlist-item-"]')]
      .map((n) => n.dataset.testid);
    expect(testids).to.deep.equal([
      'video-playlist-item-0',
      'video-playlist-item-1',
      'video-playlist-item-2',
      'video-playlist-item-3',
    ]);
    expect(new Set(testids).size).to.equal(testids.length);
  });

  it('an empty block (zero rows) does not throw and renders no featured card', async () => {
    const el = block([]);
    await decorate(el);
    expect(el.querySelector('.video-playlist-featured')).to.not.exist;
    expect(el.querySelector('.video-playlist-item')).to.not.exist;
  });

  it('a single item renders the featured card and an empty list', async () => {
    const el = block([itemRow({ id: 'only' })]);
    await decorate(el);
    expect(el.querySelector('.video-playlist-featured')).to.exist;
    expect(el.querySelector('.video-playlist-list')).to.exist;
    expect(el.querySelectorAll('.video-playlist-item')).to.have.length(0);
  });

  it('an item with no subtitle renders no subtitle node', async () => {
    const el = block([
      itemRow({ id: 'v1' }),
      itemRow({ title: 'No sub', subtitle: null, id: 'v2' }),
    ]);
    await decorate(el);
    const thumb = el.querySelector('.video-playlist-item .video-playlist-thumb');
    expect(thumb.querySelector('.video-playlist-title').textContent).to.equal('No sub');
    expect(thumb.querySelector('.video-playlist-subtitle')).to.not.exist;
  });

  it('an item with no Wistia link is a static card, not a dead play button', async () => {
    const el = block([
      itemRow({ id: 'v1' }),
      itemRow({ title: 'No video', id: null }),
    ]);
    await decorate(el);
    const staticCard = el.querySelector('.video-playlist-item .video-playlist-thumb');
    expect(staticCard.tagName).to.equal('DIV');
    expect(staticCard.classList.contains('is-static')).to.be.true;
    expect(staticCard.querySelector('.video-playlist-play')).to.not.exist;
    expect(staticCard.querySelector('.video-playlist-title').textContent).to.equal('No video');

    staticCard.click();
    expect(document.querySelector('.video-modal')).to.not.exist;
  });

  it('interactive cards are real buttons with a discernible play label', async () => {
    const el = block([itemRow({ id: 'v1' })]);
    await decorate(el);
    const featured = el.querySelector('.video-playlist-featured');
    expect(featured.tagName).to.equal('BUTTON');
    expect(featured.getAttribute('type')).to.equal('button');
    expect(featured.querySelector('.video-playlist-play .visually-hidden').textContent.trim())
      .to.not.equal('');
  });

  it('is idempotent — a second decorate() is a guarded no-op', async () => {
    const el = block([itemRow({ id: 'v1' }), itemRow({ id: 'v2' })]);
    await decorate(el);
    const featured = el.querySelector('.video-playlist-featured');
    await decorate(el);
    expect(el.querySelector('.video-playlist-featured')).to.equal(featured);
    expect(el.querySelectorAll('.video-playlist-list')).to.have.length(1);
    expect(el.querySelectorAll('.video-playlist-item')).to.have.length(1);
  });

  it('classifies by shape — poster/title/subtitle survive reordered cells', async () => {
    // Wistia link authored FIRST, heading before the poster: shape, not
    // position, must still resolve each part.
    const row = `<div>${['', wistia('rx'), '<h3>Reordered</h3>', picture(), '<p>Later</p>']
      .map((c) => `<div>${c}</div>`).join('')}</div>`;
    const el = block([row]);
    await decorate(el);
    const featured = el.querySelector('.video-playlist-featured');
    expect(featured.querySelector('.video-playlist-poster img')).to.exist;
    expect(featured.querySelector('.video-playlist-title').textContent).to.equal('Reordered');
    expect(featured.querySelector('.video-playlist-subtitle').textContent).to.equal('Later');
    featured.click();
    expect(document.querySelector('.video-modal-iframe').src).to.include('rx');
  });
});
