import { slugify } from '../../scripts/utils/slugify.js';

const fid = (label) => `form-${slugify(label)}`;

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
    if (required) node.required = true;
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

// Driven by the native Constraint Validation API (checkValidity()/validity),
// not hand-rolled required/format checks — required alone used to be
// unenforceable (only aria-required was ever set, which has no effect on
// validation), and a hand-rolled email regex silently never covered any
// other type= an author could put in the table (url, tel, pattern, minlength
// via `extra`). form.noValidate stays true so the browser's native bubble
// UI never shows — only the custom inline .form-error messaging below does.
const messageFor = (field) => {
  const { validity, type, minLength } = field;
  if (validity.valueMissing) return type === 'checkbox' ? 'This field must be checked' : 'This field is required';
  if (validity.typeMismatch) return type === 'email' ? 'Enter a valid email' : 'Enter a valid value';
  if (validity.patternMismatch) return 'Please match the requested format';
  if (validity.tooShort) return `Enter at least ${minLength} characters`;
  return '';
};

export const validate = (form) => {
  let first = null;
  for (const f of form.querySelectorAll('.form-field input, .form-field select, .form-field textarea')) {
    const msg = f.checkValidity() ? '' : messageFor(f);
    const err = f.closest('.form-field')?.querySelector('.form-error');
    if (err) err.textContent = msg;
    f.classList.toggle('form-invalid', !!msg);
    if (msg && !first) first = f;
  }
  first?.focus();
  return !first;
};
