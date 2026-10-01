import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { slugifyUnique } from '../../scripts/ak.js';

// Authors express subcategories as a heading followed by a list; decorate
// that shape into an ARIA-labeled group without adding a new authoring field.
export const decorateSubcategories = (menu) => {
  const groups = [...menu.querySelectorAll(HEADING_SELECTOR)]
    .map((heading) => ({ heading, list: heading.nextElementSibling }))
    .filter(({ list }) => list?.tagName === 'UL');

  for (const { heading, list } of groups) {
    // Use the detached fragment root when minting heading IDs: header decoration
    // runs before the fragment is attached, but sibling subcategories must still
    // see each other's assigned IDs.
    heading.id ||= slugifyUnique(heading.textContent, heading.getRootNode());
    const group = createElement('div', {
      className: 'nav-subcategory',
      role: 'group',
      'aria-labelledby': heading.id,
    });
    heading.before(group);
    group.append(heading, list);
  }

  // Bound ancestor checks to the menu: `closest()` would climb into the outer
  // nav list and misclassify loose mega-menu lists as already nested.
  const hasAncestorWithin = (el, boundary, selector) => {
    for (let node = el.parentElement; node && node !== boundary; node = node.parentElement) {
      if (node.matches(selector)) return true;
    }
    return false;
  };

  // Grid only lays out direct children, so re-parent each real content unit
  // onto the menu in document order. Avoid `display: contents`; it would couple
  // this code to fragment.js wrapper shapes.
  const shells = [...menu.children];
  const flattened = [...menu.querySelectorAll('.nav-subcategory, ul')]
    .filter((el) => el.classList.contains('nav-subcategory')
      || !hasAncestorWithin(el, menu, '.nav-subcategory, ul'));

  // Discard a structural shell only when all of its meaningful content was
  // extracted; otherwise intro copy or trailing links would be lost.
  const isStructuralWrapper = (el) => el.matches('.section, .fragment-content, .default-content, .block-content');
  const isFullyExtracted = (shell) => {
    const ownFlattened = flattened.filter((item) => shell.contains(item));
    if (!ownFlattened.length) return false;
    const hasLeftover = (node) => [...node.children].some((child) => {
      if (ownFlattened.includes(child)) return false;
      return isStructuralWrapper(child) ? hasLeftover(child) : true;
    });
    return !hasLeftover(shell);
  };
  const emptied = shells.filter(isFullyExtracted);
  menu.append(...flattened);
  emptied.forEach((shell) => shell.remove());
};
