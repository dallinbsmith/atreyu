import { getConfig } from '../../scripts/ak.js';
import { generateId, rovingTabindex, activateTab } from '../../scripts/utils/a11y.js';
import { createElement } from '../../scripts/utils/dom.js';

const { log } = getConfig();

const buildTabList = (tabItems, panels) => {
  const tabList = createElement('div', { className: 'tab-list', role: 'tablist' });

  const tabs = [...tabItems].map((item, idx) => {
    const tabId = generateId('tab');
    const panelId = generateId('tabpanel');
    const btn = createElement('button', {
      role: 'tab', id: tabId, 'aria-controls': panelId,
    }, item.textContent);

    panels[idx].id = panelId;
    panels[idx].setAttribute('role', 'tabpanel');
    panels[idx].setAttribute('aria-labelledby', tabId);
    panels[idx].setAttribute('tabindex', '0');

    btn.addEventListener('click', () => activateTab(tabs, panels, idx));
    tabList.append(btn);
    return btn;
  });

  activateTab(tabs, panels, 0);
  rovingTabindex(tabList, tabs, { orientation: 'horizontal' });

  return tabList;
};

export default (el) => {
  const tabs = el.querySelector('ul');
  if (!tabs) {
    log('Please add an unordered list to the advanced tabs block.');
    return;
  }

  const parent = el.closest('.fragment-content, main');
  parent.style = 'display: none;';

  try {
    const currSection = el.closest('.section');
    const tabItems = tabs.querySelectorAll('li');
    const panels = [...parent.querySelectorAll(':scope > .section')]
      .filter((section) => section !== currSection);

    const tabList = buildTabList(tabItems, panels);

    tabs.remove();
    el.append(tabList, ...panels);
  } finally {
    parent.removeAttribute('style');
  }
};
