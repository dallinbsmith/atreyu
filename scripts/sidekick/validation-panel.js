const PANEL_ID = 'validation-panel';
const STATUS_ICONS = { pass: '✅', warning: '⚠️', fail: '❌' };

const highlightEl = (el) => {
  if (!el) return;
  document.querySelectorAll('.validation-highlight').forEach((h) => h.classList.remove('validation-highlight'));
  el.classList.add('validation-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const createRow = ({ label, status, message, el }) => {
  const row = document.createElement('button');
  row.className = `validation-row validation-${status}`;
  row.type = 'button';
  // Built via textContent, not innerHTML — `message` can embed real authored
  // content (e.g. checkPartnerLogos()'s partner/logo name), so it must never
  // be interpolated into markup unescaped.
  const icon = document.createElement('span');
  icon.className = 'validation-icon';
  icon.textContent = STATUS_ICONS[status];
  const labelEl = document.createElement('span');
  labelEl.className = 'validation-label';
  labelEl.textContent = label;
  const msgEl = document.createElement('span');
  msgEl.className = 'validation-msg';
  msgEl.textContent = message;
  row.append(icon, labelEl, msgEl);
  if (el) row.addEventListener('click', () => highlightEl(el));
  else row.disabled = true;
  return row;
};

export const removePanel = () => {
  document.querySelector(`#${PANEL_ID}`)?.remove();
  document.querySelectorAll('.validation-highlight').forEach((h) => h.classList.remove('validation-highlight'));
};

export const createPanel = (results) => {
  removePanel();
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'validation-panel';
  const header = document.createElement('div');
  header.className = 'validation-header';
  header.innerHTML = '<strong>Content Validation</strong>';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'validation-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', removePanel);
  header.append(closeBtn);
  panel.append(header);
  const body = document.createElement('div');
  body.className = 'validation-body';
  for (const result of results) body.append(createRow(result));
  panel.append(body);
  document.body.append(panel);
  return panel;
};

export const updateRow = (panel, label, data) => {
  const rows = panel.querySelectorAll('.validation-row');
  const row = [...rows].find((r) => r.querySelector('.validation-label')?.textContent === label);
  if (!row) return;
  row.className = `validation-row validation-${data.status}`;
  row.querySelector('.validation-icon').textContent = STATUS_ICONS[data.status];
  row.querySelector('.validation-msg').textContent = data.message;
  if (data.el) {
    row.disabled = false;
    row.addEventListener('click', () => highlightEl(data.el));
  }
};

export const isPanelOpen = () => !!document.querySelector(`#${PANEL_ID}`);
