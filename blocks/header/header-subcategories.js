import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { slugifyUnique } from '../../scripts/ak.js';

// Sanity's navGroup.group[].subcategoryLabel (30+ lockup configs) grouped
// mega-menu links under a labeled heading. EDS has no equivalent authoring
// field, and per ref_nav_architecture_research memory no new one is needed:
// a heading immediately followed by a <ul> inside a mega-menu (an author
// already writes "### Column heading" above a bullet list with zero new
// convention) is decorated into a labeled, ARIA-grouped subcategory. Split
// into its own file — not header-nav.js, which is already at the header
// block's own 100-line-per-file budget (blocks.md's Structure rule).
export const decorateSubcategories = (menu) => {
  const groups = [...menu.querySelectorAll(HEADING_SELECTOR)]
    .map((heading) => ({ heading, list: heading.nextElementSibling }))
    .filter(({ list }) => list?.tagName === 'UL');

  for (const { heading, list } of groups) {
    // A heading anchor id may already exist (server-slugified) elsewhere on
    // the page; only mint one here if it doesn't, same "linking id, not a
    // styling class" discipline as decorateSection()'s `anchor` key —
    // see scripts.md's "Identifying Elements" section. getRootNode() (not
    // bare document): header.js decorates this fragment entirely while
    // still detached from `document` (see slugifyUnique's own comment) —
    // two subcategory headings in the same still-detached header can only
    // see each other's just-assigned id via their shared detached root.
    heading.id ||= slugifyUnique(heading.textContent, heading.getRootNode());
    const group = createElement('div', {
      className: 'nav-subcategory',
      role: 'group',
      'aria-labelledby': heading.id,
    });
    heading.before(group);
    group.append(heading, list);
  }

  // Bug found empirically building this fix, not hypothetical: plain
  // `el.closest(selector)` is unbounded — it walks all the way to the
  // document root, past `menu`'s own boundary. Whatever container the
  // caller passes in (today, header-nav.js's `.mega-menu-links`, not
  // `.mega-menu` itself — this function stays generic over either) lives
  // inside an `<li>` that's itself inside the outer nav's OWN `<ul class=
  // "main-nav-list">` — so `.closest('.nav-subcategory, ul')` on a loose
  // list's ancestor kept climbing past `menu` and matching that unrelated
  // outer `<ul>`, misclassifying every loose list as "already nested,
  // skip." Bounded to stop at `menu` itself.
  const hasAncestorWithin = (el, boundary, selector) => {
    for (let node = el.parentElement; node && node !== boundary; node = node.parentElement) {
      if (node.matches(selector)) return true;
    }
    return false;
  };

  // Structural flatten — root-cause fix, not a styling change
  // (ref_mega_menu_and_layer_order_findings memory). CSS Grid only
  // distributes an element's DIRECT children. Every real content unit built
  // above sits 1-2 DOM levels below `menu` — inside whichever wrapper shape
  // fragment.js's unwrap logic produced (a bare .section, or a
  // .fragment-content wrapping N .section's, see header-nav.js's own
  // comment) — so the grid always saw exactly 1 item (menu's one original
  // child) regardless of how many groups actually exist. Re-parent every
  // real content unit — a .nav-subcategory, or a bare heading-less <ul> if a
  // mega-menu item has no subcategory label at all (nothing guarantees every
  // future item will have one) — directly onto `menu`, in original document
  // order (a single querySelectorAll call on a compound selector returns
  // matches in document order regardless of which branch of the selector
  // matched). A CSS-only `display: contents` alternative was considered and
  // rejected: it would need to track fragment.js's two unwrap shapes in
  // lockstep — the exact coupling that caused the earlier `.fragment-content`
  // wrapper bug.
  const shells = [...menu.children];
  const flattened = [...menu.querySelectorAll('.nav-subcategory, ul')]
    .filter((el) => el.classList.contains('nav-subcategory')
      || !hasAncestorWithin(el, menu, '.nav-subcategory, ul'));

  // Code-review fix (real bug): a shell is only safe to discard once it is
  // FULLY accounted for by `flattened`, not merely once it contains ANY
  // flattened item — the old check silently destroyed a shell's other real
  // content (an intro paragraph, a trailing link) the moment it also held
  // one recognized group. Walk each shell's own structural wrappers
  // (`.section`/`.fragment-content`/`.default-content`/`.block-content`);
  // anything else found means real content would be lost, so leave that
  // shell untouched instead.
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
