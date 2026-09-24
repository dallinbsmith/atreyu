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
    view.querySelector('[name="End Date"]').value = '2026-12-01';
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
    view.querySelector('[name="End Date"]').value = '2026-12-01';
    view.querySelector('form').dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !view.querySelector('button.primary').disabled);

    view.querySelector('form').dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => sent.length);

    expect(sent[0].action).to.equal('sendHTML');
    expect(sent[0].details).to.contain('Personalize');
    expect(sent[0].details).to.contain('Audience: mobile');
    expect(sent[0].details).to.contain('/v/mobile');
  });
});
