import { expect } from '@esm-bundle/chai';

const PANEL_HTML = `<header class="bar">
  <nav aria-label="Experiments views" role="tablist">
    <button type="button" data-tab="page" id="tab-page" role="tab" aria-controls="view" aria-selected="true">This page</button>
    <button type="button" data-tab="site" id="tab-site" role="tab" aria-controls="view" aria-selected="false">Sitewide</button>
    <button type="button" data-tab="build" id="tab-build" role="tab" aria-controls="view" aria-selected="false">Build test</button>
  </nav>
  <button type="button" id="refresh">Refresh</button>
</header>
<main id="view" role="tabpanel" aria-labelledby="tab-page" tabindex="0"></main>`;

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => `${n}`.padStart(2, '0')).join('-');
};

// Served HTML: a flattened reserved key on section 1, a Personalize table on section 2.
const PAGE_HTML = `<html><body><main>
  <div data-audience="Mobile"><p>Hero</p></div>
  <div><p>Body</p><div class="personalize">
    <div><div><p>Name</p></div><div><p>Body by device</p></div></div>
    <div><div><p>Audience: mobile</p></div><div><p><a href="/v/body-mobile">/v/body-mobile</a></p></div></div>
    <div><div><p>End Date</p></div><div><p>${day(30)}</p></div></div>
  </div></div>
</main></body></html>`;

const waitFor = async (predicate) => {
  for (let i = 0; i < 50; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  }
  throw new Error('Timed out waiting for panel render');
};

describe('experiments-panel/panel.js', () => {
  const realFetch = window.fetch;
  const realUrl = window.location.href;

  afterEach(() => {
    window.fetch = realFetch;
    history.replaceState({}, '', realUrl);
    document.body.innerHTML = '';
  });

  it('renders a Personalize table as a section card and warns on a flattened reserved key', async () => {
    history.pushState({}, '', '/experiments-panel/index.html?page=/personalize-page.html');
    document.body.innerHTML = PANEL_HTML;
    window.fetch = async (url, init = {}) => {
      const path = new URL(url, window.location.origin).pathname;
      if (path === '/personalize-page.html') return new Response(PAGE_HTML, { status: 200 });
      if (path === '/metadata.json' || path === '/metadata-experiments.json') return new Response('{}', { status: 200 });
      if (init.method === 'HEAD') return new Response('', { status: 200 });
      throw new Error(`Unexpected fetch ${path}`);
    };

    await import(`/experiments-panel/panel.js?v=${Date.now()}`);
    await waitFor(() => document.querySelector('#view .card'));

    const view = document.querySelector('#view');
    const card = view.querySelector('.card');
    expect(card.querySelector('h2').textContent).to.equal('Body by device');
    expect(card.querySelector('.badge').textContent).to.equal('running');
    expect(card.textContent).to.include('Section 2 | Personalize table (page doc)');
    expect(card.querySelector('tr[data-path="/v/body-mobile"] td').textContent).to.equal('mobile');
    expect(new URL(card.querySelector('tr[data-path] td:last-child a').href).searchParams.get('audience')).to.equal('mobile');
    expect(view.textContent).to.include('Section 1: section metadata key "audience" does nothing');
  });

  it('shows running when the compiler serves a rule, and still lists the error for a bad row', async () => {
    const html = PAGE_HTML.replace(
      '<div><div><p>End Date</p></div>',
      '<div><div><p>Audience: nobody</p></div><div><p><a href="/v/body-nobody">/v/body-nobody</a></p></div></div><div><div><p>End Date</p></div>',
    );
    history.pushState({}, '', '/experiments-panel/index.html?page=/personalize-mixed.html');
    document.body.innerHTML = PANEL_HTML;
    window.fetch = async (url, init = {}) => {
      const path = new URL(url, window.location.origin).pathname;
      if (path === '/personalize-mixed.html') return new Response(html, { status: 200 });
      if (path === '/metadata.json' || path === '/metadata-experiments.json') return new Response('{}', { status: 200 });
      if (init.method === 'HEAD') return new Response('', { status: 200 });
      throw new Error(`Unexpected fetch ${path}`);
    };

    await import(`/experiments-panel/panel.js?v=${Date.now()}`);
    await waitFor(() => document.querySelector('#view .card'));

    const card = document.querySelector('#view .card');
    expect(card.querySelector('.badge').textContent).to.equal('running');
    expect(card.querySelector('.issues li.error').textContent).to.equal('Unknown audience "nobody".');
    expect([...card.querySelectorAll('tr[data-path]')].map((tr) => tr.dataset.path)).to.deep.equal(['/v/body-mobile']);
    expect(card.textContent).to.include('Status active');
  });

  const renderCard = async (name, html) => {
    history.pushState({}, '', `/experiments-panel/index.html?page=/${name}.html`);
    document.body.innerHTML = PANEL_HTML;
    window.fetch = async (url, init = {}) => {
      const path = new URL(url, window.location.origin).pathname;
      if (path === `/${name}.html`) return new Response(html, { status: 200 });
      if (path === '/metadata.json' || path === '/metadata-experiments.json') return new Response('{}', { status: 200 });
      if (init.method === 'HEAD') return new Response('', { status: 200 });
      throw new Error(`Unexpected fetch ${path}`);
    };
    await import(`/experiments-panel/panel.js?v=${Date.now()}`);
    await waitFor(() => document.querySelector('#view .card'));
    return document.querySelector('#view .card');
  };

  it('lists an unserved table with the compiler\'s first path from a multi-paragraph cell', async () => {
    const html = PAGE_HTML
      .replace('<p><a href="/v/body-mobile">/v/body-mobile</a></p>', '<p>/v/first</p><p>/v/second</p>')
      .replace('<div><div><p>End Date</p></div>', '<div><div><p>Status</p></div><div><p>inactive</p></div></div><div><div><p>End Date</p></div>');
    const card = await renderCard('personalize-paragraphs', html);
    expect(card.querySelector('.badge').textContent).to.equal('not served');
    expect([...card.querySelectorAll('tr[data-path]')].map((tr) => tr.dataset.path)).to.deep.equal(['/v/first']);
    expect(new URL(card.querySelector('tr[data-path] td:last-child a').href).searchParams.get('audience')).to.equal('mobile');
  });

  it('hides the Preview column when the compiler removes the section, even for an inactive table', async () => {
    const html = PAGE_HTML
      .replace('<div><p>Body</p><div class="personalize">', '<div><div class="personalize">')
      .replace('<div><div><p>End Date</p></div>', '<div><div><p>Status</p></div><div><p>inactive</p></div></div><div><div><p>End Date</p></div>');
    const card = await renderCard('personalize-removed', html);
    expect(card.querySelector('.badge').textContent).to.equal('not served');
    expect(card.textContent).to.include('the compiler removes it');
    expect([...card.querySelectorAll('tr[data-path]')].map((tr) => tr.dataset.path)).to.deep.equal(['/v/body-mobile']);
    expect(card.querySelectorAll('th')).to.have.length(2);
    expect(card.querySelector('a[href*="audience="]')).to.equal(null);
  });

  // An inactive table with this End Date; the preview compile decides.
  const inactive = (endDate) => PAGE_HTML.replace(
    `<div><div><p>End Date</p></div><div><p>${day(30)}</p></div></div>`,
    `<div><div><p>Status</p></div><div><p>inactive</p></div></div><div><div><p>End Date</p></div><div><p>${endDate}</p></div></div>`,
  );
  const INACTIVE_NOTE = 'served only in `?audience=` previews';

  it('shows no Preview links or inactive note for an inactive table whose End Date has passed', async () => {
    const card = await renderCard('personalize-inactive-ended', inactive(day(-1)));
    expect(card.querySelector('.badge').textContent).to.equal('blocked');
    expect([...card.querySelectorAll('tr[data-path]')].map((tr) => tr.dataset.path)).to.deep.equal(['/v/body-mobile']);
    expect(card.querySelectorAll('th').length).to.equal(2);
    expect(card.querySelectorAll('a[href*="audience="]').length).to.equal(0);
    expect(card.textContent).not.to.include(INACTIVE_NOTE);
  });

  for (const [what, endDate] of [['an invalid', 'soon'], ['a more-than-180-day', day(400)]]) {
    it(`shows no Preview links or inactive note for an inactive table with ${what} End Date`, async () => {
      const card = await renderCard(`personalize-inactive-bad-${endDate}`, inactive(endDate));
      expect(card.querySelectorAll('a[href*="audience="]').length).to.equal(0);
      expect(card.textContent).not.to.include(INACTIVE_NOTE);
    });
  }

  it('shows no Preview links or inactive note for an inactive table with no End Date', async () => {
    const html = inactive('x').replace('<div><div><p>End Date</p></div><div><p>x</p></div></div>', '');
    const card = await renderCard('personalize-inactive-missing', html);
    expect(card.querySelectorAll('a[href*="audience="]').length).to.equal(0);
    expect(card.textContent).not.to.include(INACTIVE_NOTE);
  });

  it('keeps Preview links and the inactive note for an inactive table with a future End Date', async () => {
    const card = await renderCard('personalize-inactive-future', inactive(day(30)));
    expect(card.querySelector('.badge').textContent).to.equal('not served');
    expect(new URL(card.querySelector('a[href*="audience="]').href).searchParams.get('audience')).to.equal('mobile');
    expect(card.textContent).to.include(INACTIVE_NOTE);
  });
});
