// Interactive quote switcher. First authored row is [heading, intro]; each
// remaining row is [category, quote, attribution]. Category tabs swap the active
// quote — the kind of stateful, keyboard-navigable UI React/component libraries
// give for free; here the tab state, ARIA wiring, and roving focus are all
// hand-built in vanilla JS (reusing the shared a11y util for roving tabindex).
import { generateId, rovingTabindex } from '../../scripts/utils/a11y.js';
import { decorateRichText } from '../../scripts/utils/richtext.js';

export default (el) => {
  const rows = [...el.children];
  rows.shift()?.classList.add('qi-head');
  if (!rows.length) return;

  const tablist = document.createElement('div');
  tablist.className = 'qi-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Quotes by industry');
  const stage = document.createElement('div');
  stage.className = 'qi-stage';

  const tabs = rows.map((row, i) => {
    const [cat, quote, attr] = [...row.children];
    const tabId = generateId('qi-tab');
    const panelId = generateId('qi-panel');

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'qi-tab';
    tab.id = tabId;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    tab.textContent = cat?.textContent.trim() || `Quote ${i + 1}`;

    const panel = document.createElement('figure');
    panel.className = 'qi-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    panel.setAttribute('tabindex', '0');
    if (quote) {
      const bq = document.createElement('blockquote');
      bq.append(...quote.childNodes);
      panel.append(bq);
    }
    if (attr) {
      const cap = document.createElement('figcaption');
      cap.append(...attr.childNodes);
      panel.append(cap);
    }

    tab.addEventListener('click', () => {
      tabs.forEach((t, j) => {
        t.setAttribute('aria-selected', String(j === i));
        t.setAttribute('tabindex', j === i ? '0' : '-1');
      });
      [...stage.children].forEach((p, j) => p.toggleAttribute('hidden', j !== i));
    });

    tablist.append(tab);
    stage.append(panel);
    return tab;
  });

  tabs.forEach((t, j) => {
    t.setAttribute('aria-selected', String(j === 0));
    t.setAttribute('tabindex', j === 0 ? '0' : '-1');
  });
  [...stage.children].forEach((p, j) => p.toggleAttribute('hidden', j !== 0));

  rows.forEach((r) => r.remove());
  el.append(tablist, stage);
  rovingTabindex(tablist, tabs, { orientation: 'horizontal' });
  decorateRichText(el);
};
