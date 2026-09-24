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

const PAGE_HTML = `<html><body><main>
  <div><p>Hero</p><div class="section-metadata">
    <div><div>Experiment</div><div>Warning Test</div></div>
    <div><div>Experiment Variants</div><div><a href="/v/warning-test">Variant</a></div></div>
    <div><div>Experiment End Date</div><div>2020-01-01</div></div>
    <div><div>Experiment Variant Names</div><div>Bold</div></div>
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

  it('renders section ignored-field warnings from parsed panel config', async () => {
    history.pushState({}, '', '/experiments-panel/index.html?page=/warning-page.html');
    document.body.innerHTML = PANEL_HTML;
    window.fetch = async (url, init = {}) => {
      const path = new URL(url, window.location.origin).pathname;
      if (path === '/warning-page.html') return new Response(PAGE_HTML, { status: 200 });
      if (path === '/metadata.json' || path === '/metadata-experiments.json') return new Response('{}', { status: 200 });
      if (init.method === 'HEAD') return new Response('', { status: 200 });
      throw new Error(`Unexpected fetch ${path}`);
    };

    await import(`/experiments-panel/panel.js?v=${Date.now()}`);
    await waitFor(() => document.querySelector('#view')?.textContent.includes('End Date is ignored by plugin at section scope.'));

    const text = document.querySelector('#view').textContent;
    expect(text).to.include('Warning Test');
    expect(text).to.include('running');
    expect(text).to.include('Dates: open to open');
    expect(text).to.include('Challenger 1');
    expect(text).not.to.include('Bold');
  });
});
