import { makeField, validate } from './form-fields.js';
import { getMessages } from './form-messages.js';
import { getConfig } from '../../scripts/ak.js';

// An explicit "submit: Send it" key prefix — not a bare "Submit" value match,
// which could misread a real field literally labeled "Submit" as this
// override instead of a field to render.
const SUBMIT_RE = /^submit\s*:\s*(.+)$/i;
const SUBMIT_TIMEOUT_MS = 15000;

const showMessage = (el, className, text) => {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  el.replaceChildren(p);
};

export default async (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  // The endpoint row is the only single-column row in this block's authoring
  // convention (every field row has 2+ columns) — classified by shape, not
  // position, per blocks.md's Row Classification rule.
  const endpointRow = rows.find((r) => r.children.length === 1);
  const endpoint = endpointRow?.children[0]?.textContent.trim();
  const fieldRows = rows.filter((r) => r !== endpointRow);
  const submitMatch = fieldRows.at(-1)?.children[0]?.textContent.trim().match(SUBMIT_RE);
  if (submitMatch) fieldRows.pop();
  const fields = fieldRows.map((r) => {
    const c = [...r.children].map((col) => col.textContent.trim());
    return { label: c[0], type: c[1] || 'text', required: c[2]?.toLowerCase() === 'required', extra: c[3] };
  }).filter((f) => f.label);

  const messages = await getMessages();
  const submitText = submitMatch ? submitMatch[1].trim() : messages.submitText;

  const form = document.createElement('form');
  form.noValidate = true;
  const honey = document.createElement('input');
  Object.assign(honey, {
    type: 'text', name: 'website', tabIndex: -1, autocomplete: 'off',
  });
  honey.setAttribute('aria-hidden', 'true');
  honey.className = 'form-hp';
  form.append(honey, ...fields.map((f) => makeField(f, messages)));
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.textContent = submitText;
  btn.className = 'form-submit';
  btn.dataset.testid = 'form-submit';
  form.append(btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Guards against a second submit firing before the button is visually
    // disabled or before the first fetch resolves — ordinary click/Enter
    // submission is already safe via native disabled-button semantics, but
    // form.requestSubmit() called twice (or a stray extra listener) isn't.
    if (btn.disabled) return;
    if (honey.value) {
      showMessage(el, 'form-success', messages.honeypotSuccessMsg);
      return;
    }
    if (!validate(form, messages)) return;
    btn.disabled = true;
    btn.textContent = messages.sendingText;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(res.statusText);
      showMessage(el, 'form-success', messages.successMsg);
    } catch (ex) {
      getConfig().log(ex, el);
      btn.disabled = false;
      btn.textContent = submitText;
      const msg = form.querySelector('.form-status') ?? document.createElement('p');
      msg.className = 'form-status form-error-msg';
      msg.setAttribute('aria-live', 'polite');
      msg.textContent = messages.errorMsg;
      if (!msg.parentNode) form.append(msg);
    }
  });
  el.replaceChildren(form);
};
