/**
 * Local Stylelint plugin: flags a raw numeric `z-index` on a `position: fixed`
 * element (declared on the same rule, or an ancestor rule via native CSS
 * nesting, whose OWN z-index isn't already a token) instead of a `var(--z-*)`
 * token from the global scale in styles.css. This is the exact shape of two
 * real, confirmed bugs in this project's history — see .claude/rules/css.md's
 * "Z-Index and Stacking Contexts" section:
 *  - header.css's `z-index: 1000` (should have been `var(--z-index-nav)`),
 *    which rendered the fixed header ABOVE every real modal in the app and
 *    above the WCAG skip-to-content link's focused state;
 *  - quote-interactive.css's `.qi-hover` `z-index: 3`, a fixed/body-appended
 *    hover-preview card that happened not to collide with anything only by
 *    luck, not because the value was actually coordinated with anything.
 *
 * Does NOT flag a raw z-index on an element that is not (and has no ancestor
 * rule that is) `position: fixed` — that's this project's local tier
 * (background-behind-text, decorative pseudo-elements, contained by
 * `isolation: isolate`/`overflow: hidden`), which is correct and expected to
 * use small raw integers directly, per the same css.md rule.
 *
 * Also does NOT flag a raw z-index nested inside a `position: fixed` ancestor
 * whose OWN z-index is already a token (e.g. header.css's `.language`
 * mega-menu submenu, nested inside `header { position: fixed; z-index:
 * var(--z-index-nav); ... }`) — once the ancestor has actually established
 * global-tier containment via a token, everything nested inside it is by
 * definition local to that already-safe context, matching css.md's own
 * step-zero rule. (Fixed 2026-09-08 after a review found the first version of
 * this rule flagged exactly this real, already-correct pattern — it only
 * escaped detection by accident of header.css's `.language` rule living in a
 * textually separate `@media` occurrence rather than nested via `&`, not
 * because the logic was actually right.)
 *
 * Known, accepted limitations (a lint-time heuristic, not full certification
 * — see .claude/rules/agent-behavior.md's stance on pattern-matching vs.
 * certifying something safe):
 *  - only tracks `position: fixed` declared on the same rule or a direct
 *    ancestor rule (the real CSS-nesting parent chain) — a `position: fixed`
 *    declared only in a *sibling* nested rule (e.g. `&:focus { position:
 *    fixed }` next to a differently-nested selector that sets z-index) is not
 *    tracked, since that needs full selector-group resolution this rule
 *    doesn't attempt. (No real instance of this shape exists in this codebase
 *    today — styles.css's `.skip-to-content` is the closest case, and its
 *    z-index is already a token, so this gap has zero known false negatives
 *    currently, not zero theoretical ones.)
 *  - only catches CSS-visible escapes (`position: fixed`) — an element that
 *    escapes its own block by being appended to `document.body` in JS without
 *    ever being `position: fixed` is invisible to a CSS-only linter and still
 *    needs the human judgment call css.md documents. Every real body-appended
 *    element in this codebase today is also `position: fixed`, so this is
 *    believed to have zero current false negatives, not a theoretical-only
 *    gap.
 */
import stylelint from 'stylelint';

const ruleName = 'atreyu/z-index-requires-token';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (value) => `z-index: ${value} on a position: fixed element must use a var(--z-*) token, `
    + 'not a raw number — see .claude/rules/css.md\'s "Z-Index and Stacking Contexts" section. '
    + 'This exact shape (a raw number on a fixed/escaping element with no token establishing '
    + 'its containment) caused two real production bugs before: header.css rendered above every '
    + "modal in the app, and quote-interactive.css's .qi-hover only avoided colliding by luck.",
});

const meta = { url: 'https://github.com/dallinbsmith/atreyu' };

const isRawNumber = (value) => /^-?\d+$/.test(value.trim());

// A rule's own direct declaration for `prop` — never recurses into nested
// child rules, which is what a plain `rule.walkDecls()` would incorrectly do.
const ownDecl = (rule, prop) => rule.nodes?.find(
  (node) => node.type === 'decl' && node.prop === prop,
) ?? null;

// Walks up from `startNode` looking for the nearest ancestor rule (including
// the declaration's own rule) that declares `position: fixed`.
//  - 'safe'   — found one, and its OWN z-index is already a token/calc(), so
//               anything nested inside is contained by an already-established
//               global-tier context (matches header.css's `.language` case).
//  - 'unsafe' — found one, but its own z-index is missing or itself a raw
//               number — nothing has actually established safe containment.
//  - 'none'   — no position: fixed ancestor found at all (local tier).
const fixedAncestorStatus = (startNode) => {
  let node = startNode;
  while (node) {
    if (node.type === 'rule') {
      const positionDecl = ownDecl(node, 'position');
      if (positionDecl?.value.trim() === 'fixed') {
        const zIndexDecl = ownDecl(node, 'z-index');
        return zIndexDecl && !isRawNumber(zIndexDecl.value) ? 'safe' : 'unsafe';
      }
    }
    node = node.parent;
  }
  return 'none';
};

const rule = (primary) => (root, result) => {
  if (!primary) return;

  root.walkDecls('z-index', (decl) => {
    if (!isRawNumber(decl.value)) return; // var(...)/calc(...)/etc. are always fine
    if (fixedAncestorStatus(decl.parent) !== 'unsafe') return; // 'none' (local tier) or 'safe' (already contained)

    stylelint.utils.report({
      message: messages.rejected(decl.value),
      node: decl,
      result,
      ruleName,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default stylelint.createPlugin(ruleName, rule);
