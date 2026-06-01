const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fid = (label) => `form-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export const makeField = ({ label, type, required, extra }) => {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';
  const fieldId = fid(label);
  const lbl = document.createElement('label');
  lbl.htmlFor = fieldId;
  lbl.textContent = label;
  if (required) lbl.classList.add('form-required');
  const setAttrs = (node) => {
    node.id = fieldId;
    node.name = fieldId;
    if (required) node.setAttribute('aria-required', 'true');
  };
  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 4;
    if (extra) input.placeholder = extra;
  } else if (type === 'select') {
    input = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = `Select ${label}`;
    input.append(blank, ...(extra ?? '').split(',').map((v) => {
      const opt = document.createElement('option');
      opt.value = v.trim();
      opt.textContent = v.trim();
      return opt;
    }));
  } else if (type === 'checkbox') {
    input = document.createElement('input');
    input.type = 'checkbox';
    lbl.prepend(input, ' ');
    setAttrs(input);
    wrap.append(lbl);
    return wrap;
  } else {
    input = document.createElement('input');
    input.type = type;
    if (type === 'hidden') input.value = extra ?? '';
    else if (extra) input.placeholder = extra;
  }
  setAttrs(input);
  const err = document.createElement('span');
  err.className = 'form-error';
  err.setAttribute('aria-live', 'polite');
  if (type === 'hidden') {
    wrap.append(lbl, input);
    wrap.hidden = true;
  } else wrap.append(lbl, input, err);
  return wrap;
};

export const validate = (form) => {
  let first = null;
  for (const f of form.querySelectorAll('[aria-required="true"]')) {
    const empty = f.type === 'checkbox' ? !f.checked : !f.value.trim();
    const badEmail = !empty && f.type === 'email' && !EMAIL_RE.test(f.value);
    let msg = '';
    if (empty) msg = 'This field is required';
    else if (badEmail) msg = 'Enter a valid email';
    const err = f.closest('.form-field')?.querySelector('.form-error');
    if (err) err.textContent = msg;
    f.classList.toggle('form-invalid', !!msg);
    if (msg && !first) first = f;
  }
  first?.focus();
  return !first;
};
