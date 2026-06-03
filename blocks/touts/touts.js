// Touts: a light, icon-led row of value props (title + body, optional :icon:).
// Distinct from bentos — no card surface, just clean columns. Reuses the shared
// tout decoration so CTA/icon/title/body handling matches the rest of the site.
import { decorateTout } from '../../scripts/utils/touts.js';

export default (el) => {
  [...el.children].forEach((row) => {
    row.classList.add('touts-row');
    const items = [...row.children];
    row.style = `--tout-count: ${items.length}`;
    items.forEach((item) => decorateTout(item, 'tout'));
  });
};
