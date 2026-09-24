import { expect } from '@esm-bundle/chai';
import renderPersonalize from '../../experiments-panel/personalize-form.js';

const wait = () => new Promise((resolve) => { setTimeout(resolve, 0); });
const waitFor = async (predicate) => {
  for (let i = 0; i < 20; i += 1) {
    if (predicate()) return;
    await wait();
  }
  throw new Error('Timed out waiting for personalize form');
};
const dateAfter = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, '0'),
    `${date.getDate()}`.padStart(2, '0'),
  ].join('-');
};
const table = (rows) => `<table><tr><td colspan="2">Personalize</td></tr>${
  rows.map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`).join('')
}</table>`;
const portWithSelection = (html) => ({
  addEventListener: () => {},
  removeEventListener: () => {},
  start: () => {},
  postMessage: ({ action }) => {
    if (action !== 'getSelection') return;
    setTimeout(() => window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://da.live',
      source: window.parent,
      data: { action: 'sendSelection', details: html },
    })));
  },
});

describe('experiments-panel/personalize-form.js', () => {
  const realFetch = window.fetch;

  afterEach(() => {
    window.fetch = realFetch;
    document.body.innerHTML = '';
  });

  it('renders validation errors and disables submit until required values are set', async () => {
    window.fetch = async () => new Response('<main><div>ok</div></main>');
    const view = document.createElement('main');
    renderPersonalize({ view, pageHtml: '' });
    await wait();

    expect(view.textContent).to.include('Add at least one audience rule.');
    expect(view.textContent).to.include('End Date is required.');
    expect(view.querySelector('button.primary').disabled).to.equal(true);

    view.querySelector('[name="audience-0"]').value = 'mobile';
    view.querySelector('[name="path-0"]').value = '/v/mobile';
    view.querySelector('[name="End Date"]').value = dateAfter(30);
    view.querySelector('form').dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => view.querySelector('.issues').textContent === '');

    expect(view.querySelector('.issues').textContent).to.equal('');
    expect(view.querySelector('button.primary').disabled).to.equal(false);
  });

  it('sends a Personalize table through the DA port', async () => {
    window.fetch = async () => new Response('<main><div>ok</div></main>');
    const sent = [];
    const port = {
      addEventListener: () => {},
      removeEventListener: () => {},
      start: () => {},
      postMessage: (message) => sent.push(message),
    };
    const view = document.createElement('main');
    renderPersonalize({ view, port, pageHtml: '' });
    view.querySelector('[name="Name"]').value = 'Hero Match';
    view.querySelector('[name="audience-0"]').value = 'mobile';
    view.querySelector('[name="path-0"]').value = '/v/mobile';
    view.querySelector('[name="End Date"]').value = dateAfter(30);
    view.querySelector('form').dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !view.querySelector('button.primary').disabled);

    view.querySelector('form').dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => sent.length);

    expect(sent[0].action).to.equal('sendHTML');
    expect(sent[0].details).to.contain('Personalize');
    expect(sent[0].details).to.contain('Audience: mobile');
    expect(sent[0].details).to.contain('/v/mobile');
  });

  it('loads at most three rules and clears stale fields', async () => {
    const view = document.createElement('main');
    renderPersonalize({
      view,
      port: portWithSelection(table([
        ['Name', 'Loaded'],
        ['Audience: mobile', '<a href="/v/mobile">/v/mobile</a>'],
        ['Audience: desktop', '<a href="/v/desktop">/v/desktop</a>'],
        ['Audience: campaign-sale', '<a href="/v/sale">/v/sale</a>'],
        ['Audience: campaign-extra', '<a href="/v/extra">/v/extra</a>'],
        ['End Date', dateAfter(30)],
        ['Owner', 'CRO'],
      ])),
      pageHtml: '',
    });
    view.querySelector('[name="audience-2"]').value = 'desktop';
    view.querySelector('[name="path-2"]').value = '/v/stale';
    view.querySelector('button.load').click();
    await waitFor(() => view.textContent.includes('Loaded the selected Personalize table.'));

    expect(view.querySelector('[name="audience-0"]').value).to.equal('mobile');
    expect(view.querySelector('[name="path-2"]').value).to.equal('/v/sale');
    expect(view.textContent).to.include('Only the first 3 audience rules are kept.');
  });

  it('clears fields that are absent from the loaded table', async () => {
    const pageHtml = `<main><div><div class="personalize">
      <div><div>Name</div><div>Stale</div></div>
      <div><div>Audience: mobile</div><div>/v/mobile</div></div>
      <div><div>Audience: desktop</div><div>/v/desktop</div></div>
      <div><div>End Date</div><div>${dateAfter(20)}</div></div>
      <div><div>Owner</div><div>Old</div></div>
    </div></div></main>`;
    const view = document.createElement('main');
    renderPersonalize({
      view,
      port: portWithSelection(table([['Audience: mobile', '/v/new'], ['End Date', dateAfter(30)]])),
      pageHtml,
    });
    view.querySelector('button.load').click();
    await waitFor(() => view.textContent.includes('Loaded the selected Personalize table.'));

    expect(view.querySelector('[name="Name"]').value).to.equal('');
    expect(view.querySelector('[name="Owner"]').value).to.equal('');
    expect(view.querySelector('[name="audience-1"]').value).to.equal('');
    expect(view.querySelector('[name="path-1"]').value).to.equal('');
  });

  it('does not show loaded after a failed load', async () => {
    const port = {
      addEventListener: () => {},
      removeEventListener: () => {},
      start: () => {},
      postMessage: () => { throw new Error('port failed'); },
    };
    const view = document.createElement('main');
    renderPersonalize({ view, port, pageHtml: '' });
    view.querySelector('button.load').click();
    await waitFor(() => !view.querySelector('button.load').disabled);

    expect(view.textContent).to.not.include('Loaded the selected Personalize table.');
  });

  it('warns when the loaded table is inactive because the compiler would reject it', async () => {
    const view = document.createElement('main');
    renderPersonalize({
      view,
      port: portWithSelection(table([['Audience: mobile', '/v/mobile'], ['End Date', 'March 1, 2026']])),
      pageHtml: '',
    });
    view.querySelector('button.load').click();
    await waitFor(() => view.textContent.includes('Loaded table is inactive'));

    expect(view.querySelector('[name="End Date"]').value).to.equal('');
    expect(view.textContent).to.include('End Date must use YYYY-MM-DD.');
  });

  it('keeps edits made while loading selected content', async () => {
    const view = document.createElement('main');
    renderPersonalize({
      view,
      port: portWithSelection(table([['Name', 'Loaded'], ['Audience: mobile', '/v/mobile'], ['End Date', dateAfter(30)]])),
      pageHtml: '',
    });
    view.querySelector('button.load').click();
    view.querySelector('[name="Name"]').value = 'Editing';
    view.querySelector('form').dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => view.textContent.includes('kept your edits'));

    expect(view.querySelector('[name="Name"]').value).to.equal('Editing');
  });

  it('runs path fetch warnings only on path changes and caches by path', async () => {
    let fetches = 0;
    window.fetch = async () => {
      fetches += 1;
      return new Response('<main><div>one</div><div>two</div></main>');
    };
    const view = document.createElement('main');
    renderPersonalize({ view, pageHtml: '' });
    view.querySelector('[name="audience-0"]').value = 'mobile';
    view.querySelector('[name="path-0"]').value = '/v/mobile';
    view.querySelector('[name="End Date"]').value = dateAfter(30);
    view.querySelector('[name="Name"]').value = 'No fetch yet';
    view.querySelector('form').dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    expect(fetches).to.equal(0);

    view.querySelector('[name="path-0"]').dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => view.textContent.includes('has more than one section'));
    view.querySelector('[name="path-0"]').dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    expect(fetches).to.equal(1);
  });
});
