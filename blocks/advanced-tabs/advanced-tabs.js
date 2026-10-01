import { getConfig } from '../../scripts/ak.js';
import { generateId, rovingTabindex, activateTab } from '../../scripts/utils/a11y.js';
import { createElement } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

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
  if (!guardDecorate(el, 'advancedTabsDecorated')) return;
  const tabs = el.querySelector('ul');
  if (!tabs) {
    log('Please add an unordered list to the advanced tabs block.');
    return;
  }

  const parent = el.closest('.fragment-content, main');
  parent.style = 'display: none;';

  try {
    const currSection = el.closest('.section');
    const panels = [...parent.querySelectorAll(':scope > .section')]
      .filter((section) => section !== currSection);
    // No panels means no tabs: leave the authored <ul> rather than build an
    // empty role="tablist" (ARIA requires it to own at least one tab).
    if (!panels.length) {
      log('Advanced tabs: no sibling sections to use as panels.');
      return;
    }
    // Tab labels pair with sibling sections by order, so a label with no
    // section left to pair with is dropped rather than crashing the block.
    const allItems = [...tabs.querySelectorAll('li')];
    const tabItems = allItems.slice(0, panels.length);
    if (allItems.length > tabItems.length) {
      log(`Advanced tabs: ${allItems.length - tabItems.length} tab(s) have no matching section and were skipped.`);
    }
    if (panels.length > allItems.length) {
      log(`Advanced tabs: ${panels.length - allItems.length} section(s) have no tab label and will be hidden.`);
    }

    const tabList = buildTabList(tabItems, panels);

    tabs.remove();
    el.append(tabList, ...panels);
  } finally {
    parent.removeAttribute('style');
  }
};
