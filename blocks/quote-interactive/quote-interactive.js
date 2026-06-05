import { generateId, rovingTabindex } from '../../scripts/utils/a11y.js';
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { initHover } from './quote-hover.js';
import { initModal } from './quote-modal.js';

export default (el) => {
  const rows = [...el.children];
  const head = rows.shift();
  head?.classList.add('qi-head');
  if (!rows.length) return;

  const headingText = head?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim();

  const tablist = document.createElement('div');
  tablist.className = 'qi-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', headingText || 'Customer quotes by industry');
  const stage = document.createElement('div');
  stage.className = 'qi-stage';

  const slides = [];
  const tabs = rows.map((row, i) => {
    const pic = row.querySelector('picture, img');
    const icon = row.querySelector('.icon');
    const skip = (c) => (pic && c.contains(pic)) || (icon && c.contains(icon));
    const [cat, quote, attr] = [...row.children].filter((c) => !skip(c));

    slides.push({
      i,
      category: cat?.textContent.trim() || `Quote ${i + 1}`,
      quoteHTML: quote?.innerHTML ?? '',
      attrHTML: attr?.innerHTML ?? '',
      pic: pic ? (pic.closest('picture') ?? pic).cloneNode(true) : null,
      icon: icon?.cloneNode(true) ?? null,
    });
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
    if (pic) {
      const bg = document.createElement('div');
      bg.className = 'qi-bg';
      bg.setAttribute('aria-hidden', 'true');
      bg.append(pic.closest('picture') ?? pic);
      panel.prepend(bg);
    }
    if (icon) {
      const logo = document.createElement('div');
      logo.className = 'qi-logo';
      logo.setAttribute('aria-hidden', 'true');
      logo.append(icon);
      panel.append(logo);
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

  const gradient = document.createElement('div');
  gradient.className = 'qi-gradient';
  gradient.setAttribute('aria-hidden', 'true');
  gradient.innerHTML = slides.map(({ category }) => category).join('<br>');

  const tabWrap = document.createElement('div');
  tabWrap.className = 'qi-tab-wrap';
  tabWrap.append(tablist, gradient);

  rows.forEach((r) => r.remove());
  el.append(tabWrap, stage);
  rovingTabindex(tablist, tabs, { orientation: 'horizontal' });
  decorateRichText(el);

  const mql = window.matchMedia('(width >= 768px)');
  initHover(el, tabs, slides, mql);
  const openModal = initModal(el, tabs, slides);
  tabs.forEach((tab, i) => tab.addEventListener('click', () => mql.matches && openModal(i)));
};
