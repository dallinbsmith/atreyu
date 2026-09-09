import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';
import decorate from '../../blocks/form/form.js';

const block = (endpoint, fieldRows) => {
  const el = document.createElement('div');
  el.className = 'form';
  const mk = (cells) => {
    const row = document.createElement('div');
    cells.forEach((text) => {
      const cell = document.createElement('div');
      cell.textContent = text;
      row.append(cell);
    });
    return row;
  };
  el.append(mk([endpoint]));
  fieldRows.forEach((cells) => el.append(mk(cells)));
  document.body.append(el);
  return el;
};

// Only intercepts calls to the block's own configured endpoint — the
// placeholders.json lookup (getPlaceholder, invoked by every decorate() call
// below) is left to hit the real (404-ing) test server and gracefully fall
// back to the English default strings, matching how carousel.test.js and
// pricing rely on that same fallback without stubbing fetch at all.
const stubFetch = (endpoint, handler) => {
  const original = window.fetch;
  window.fetch = (url, opts) => (url === endpoint ? handler(url, opts) : original(url, opts));
  return () => { window.fetch = original; };
};

// A real wall-clock wait for the async submit handler's fetch round trip to
// settle — same pattern used in test/utils/analytics/pzn.test.js, since the
// 'submit' event listener isn't itself awaitable from dispatchEvent().
const tick = (ms = 50) => new Promise((r) => { setTimeout(r, ms); });

describe('form', () => {
  let logCalls;

  before(() => {
    setConfig({ log: (ex, el) => logCalls.push({ ex, el }) });
  });

  beforeEach(() => { logCalls = []; });

  let restoreFetch;
  afterEach(() => restoreFetch?.());

  it('builds a field input per field row and points the form at the endpoint row', async () => {
    const el = block('/api/submit', [['Email', 'email']]);
    await decorate(el);
    expect(el.querySelector('form')).to.exist;
    expect(el.querySelector('input[type="email"]')).to.exist;
  });

  it('defaults submit button text to "Submit" with no override row', async () => {
    const el = block('/api/submit', [['Email', 'email']]);
    await decorate(el);
    expect(el.querySelector('.form-submit').textContent).to.equal('Submit');
  });

  it('a trailing "submit: text" row overrides the button text and is not rendered as a field', async () => {
    const el = block('/api/submit', [['Email', 'email'], ['submit: Send it']]);
    await decorate(el);
    expect(el.querySelector('.form-submit').textContent).to.equal('Send it');
    expect(el.querySelectorAll('.form-field')).to.have.length(1);
  });

  it('a real field literally labeled "Submit" is rendered as a field, not consumed as the override', async () => {
    const el = block('/api/submit', [['Email', 'email'], ['Submit', 'text']]);
    await decorate(el);
    expect(el.querySelector('.form-submit').textContent).to.equal('Submit');
    expect(el.querySelectorAll('.form-field')).to.have.length(2);
    expect(el.querySelector('label[for="form-submit"]')).to.exist;
  });

  it('successful submission shows the localized success message and calls fetch with the right endpoint/body', async () => {
    const el = block('/api/submit', [['Email', 'email', 'required']]);
    let capturedUrl;
    let capturedOpts;
    restoreFetch = stubFetch('/api/submit', async (url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return new Response(null, { status: 200 });
    });
    await decorate(el);
    el.querySelector('input[type="email"]').value = 'a@b.com';
    el.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();

    expect(el.querySelector('.form-success')?.textContent)
      .to.equal('Thank you! Your submission has been received.');
    expect(capturedUrl).to.equal('/api/submit');
    expect(capturedOpts.method).to.equal('POST');
    expect(capturedOpts.body).to.be.instanceOf(FormData);
  });

  it('honeypot-tripped submission shows success but never calls fetch', async () => {
    const el = block('/api/submit', [['Email', 'email']]);
    let fetchCalled = false;
    restoreFetch = stubFetch('/api/submit', async () => {
      fetchCalled = true;
      return new Response(null, { status: 200 });
    });
    await decorate(el);
    el.querySelector('.form-hp').value = 'i am a bot';
    el.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();

    expect(el.querySelector('.form-success')?.textContent).to.equal('Thank you!');
    expect(fetchCalled).to.be.false;
  });

  it('failed submission re-enables the button, restores its text, and logs the error', async () => {
    const el = block('/api/submit', [['Email', 'email']]);
    restoreFetch = stubFetch('/api/submit', async () => { throw new Error('network down'); });
    await decorate(el);
    const form = el.querySelector('form');
    const btn = el.querySelector('.form-submit');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();

    expect(btn.disabled).to.be.false;
    expect(btn.textContent).to.equal('Submit');
    expect(el.querySelector('.form-error-msg')?.textContent)
      .to.equal('Something went wrong. Please try again.');
    expect(logCalls).to.have.length(1);
    expect(logCalls[0].ex.message).to.equal('network down');
  });

  it('double-submit guard: two synchronous submit dispatches before the first resolves only trigger one fetch call', async () => {
    const el = block('/api/submit', [['Email', 'email']]);
    let callCount = 0;
    const { promise, resolve } = Promise.withResolvers();
    restoreFetch = stubFetch('/api/submit', async () => {
      callCount += 1;
      await promise;
      return new Response(null, { status: 200 });
    });
    await decorate(el);
    const form = el.querySelector('form');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    resolve();
    await tick();

    expect(callCount).to.equal(1);
  });

  it('checkbox field renders an error message when validation fails', async () => {
    const el = block('/api/submit', [['Agree to terms', 'checkbox', 'required']]);
    await decorate(el);
    el.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick(0);

    const err = el.querySelector('.form-field .form-error');
    expect(err).to.exist;
    expect(err.textContent).to.equal('This field must be checked');
  });

  it('passes an AbortSignal.timeout() signal to the submit fetch call', async () => {
    const el = block('/api/submit', [['Email', 'email']]);
    let capturedOpts;
    restoreFetch = stubFetch('/api/submit', async (url, opts) => {
      capturedOpts = opts;
      return new Response(null, { status: 200 });
    });
    await decorate(el);
    el.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await tick();

    expect(capturedOpts.signal).to.be.instanceOf(AbortSignal);
  });
});
