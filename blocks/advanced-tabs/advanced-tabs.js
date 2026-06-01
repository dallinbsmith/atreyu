import { getConfig } from '../../scripts/ak.js';
import { generateId, rovingTabindex } from '../../scripts/utils/a11y.js';

const { log } = getConfig();

const activateTab = (tabList, panels, idx) => {
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, i) => {
    const active = i === idx;
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
  });
  panels.forEach((panel, i) => {
    panel.toggleAttribute('hidden', i !== idx);
  });
};

const buildTabList = (tabItems, panels) => {
  const tabList = document.createElement('div');
  tabList.className = 'tab-list';
  tabList.setAttribute('role', 'tablist');

  const tabs = [...tabItems].map((item, idx) => {
    const tabId = generateId('tab');
    const panelId = generateId('tabpanel');
    const btn = document.createElement('button');
    btn.setAttribute('role', 'tab');
    btn.id = tabId;
    btn.textContent = item.textContent;
    btn.setAttribute('aria-controls', panelId);

    panels[idx].id = panelId;
    panels[idx].setAttribute('role', 'tabpanel');
    panels[idx].setAttribute('aria-labelledby', tabId);
    panels[idx].setAttribute('tabindex', '0');

    btn.addEventListener('click', () => activateTab(tabList, panels, idx));
    tabList.append(btn);
    return btn;
  });

  activateTab(tabList, panels, 0);
  rovingTabindex(tabList, tabs, { orientation: 'horizontal' });

  return tabList;
};

export default (el) => {
  const parent = el.closest('.fragment-content, main');
  parent.style = 'display: none;';

  const currSection = el.closest('.section');
  const tabs = el.querySelector('ul');

  if (!tabs) {
    log('Please add an unordered list to the advanced tabs block.');
    return;
  }

  const tabItems = tabs.querySelectorAll('li');
  const panels = [...parent.querySelectorAll(':scope > .section')]
    .filter((section) => section !== currSection);

  const tabList = buildTabList(tabItems, panels);

  tabs.remove();
  el.append(tabList, ...panels);
  parent.removeAttribute('style');
};
