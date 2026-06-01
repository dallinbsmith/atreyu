import { makeField, validate } from './form-fields.js';

export default (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  const endpoint = rows[0]?.children[0]?.textContent.trim();
  const fieldRows = rows.slice(1);
  const submitText = fieldRows.at(-1)?.children[0]?.textContent.trim().toLowerCase() === 'submit'
    ? fieldRows.pop().children[0].textContent.trim() : 'Submit';
  const fields = fieldRows.map((r) => {
    const c = [...r.children].map((col) => col.textContent.trim());
    return { label: c[0], type: c[1] || 'text', required: c[2]?.toLowerCase() === 'required', extra: c[3] };
  }).filter((f) => f.label);

  const form = document.createElement('form');
  form.noValidate = true;
  const honey = document.createElement('input');
  Object.assign(honey, { type: 'text', name: 'website', tabIndex: -1, autocomplete: 'off' });
  honey.setAttribute('aria-hidden', 'true');
  honey.className = 'form-hp';
  form.append(honey, ...fields.map(makeField));
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.textContent = submitText;
  btn.className = 'form-submit';
  form.append(btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (honey.value) {
      el.innerHTML = '<p class="form-success">Thank you!</p>';
      return;
    }
    if (!validate(form)) return;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new FormData(form) });
      if (!res.ok) throw new Error(res.statusText);
      el.innerHTML = '<p class="form-success">Thank you! Your submission has been received.</p>';
    } catch {
      btn.disabled = false;
      btn.textContent = submitText;
      const msg = form.querySelector('.form-status') ?? document.createElement('p');
      msg.className = 'form-status form-error-msg';
      msg.setAttribute('aria-live', 'polite');
      msg.textContent = 'Something went wrong. Please try again.';
      if (!msg.parentNode) form.append(msg);
    }
  });
  el.replaceChildren(form);
};
