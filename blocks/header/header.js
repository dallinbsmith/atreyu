import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { createElement } from '../../scripts/utils/dom.js';
import { decorateNavSection } from './header-nav.js';
import { HEADER_PATH, decorateWidgets, isWidgetLink } from './header-actions.js';
import { guardDecorate, registerRedecorator } from '../../scripts/utils/lifecycle.js';

// UC-02 (ref_nav_architecture_research memory): registered once, at module
// scope, before any late-phase experiment can run. `.main-nav-section`'s own
// class survives experimentation.js's target.replaceChildren() untouched
// (replaceChildren only replaces children, never the target's own
// attributes) — so decorateNavSection can just redecorate the fresh swapped-in
// content in place, no wrapper reconstruction needed.
registerRedecorator('.main-nav-section', decorateNavSection);

const contentLinks = (section) => [...section.querySelectorAll('a')].filter((a) => !isWidgetLink(a));

// Business-critical, order-independent CTA slot (ref_nav_architecture_
// research memory): an author can label any content link in the actions
// section "cta: <label>" instead of relying on last-link-wins list position.
// Mirrors form.js's existing `submit: <text>` prefix convention — same
// `key: value` text-prefix idiom (blocks.md's Row Classification rule),
// applied to a link's own text instead of a row. Falls back to the original
// last-link-wins heuristic when no link uses the prefix, so already-authored
// header content keeps working unchanged — verified 2026-09-21 against the
// real DA header fragment (/system/fragments/nav/header): two links, "Sign
// In"/"Get Started," neither prefixed, zero blast radius. Deliberately a
// direct prefix check, not a SLOTS config array for a hypothetical second
// slot (e.g. sign-in) — per this project's rule-of-three, that's premature
// until a second slot is actually requested.
//
// Author note: the prefix is matched against the link's own direct text
// nodes only — inline formatting spanning the whole label (e.g.
// `[**cta: Sign up**](url)` → `<a><strong>cta: Sign up</strong></a>`) won't
// match. Type `cta:` as plain, unformatted text at the start of the link
// label. (Same accepted tradeoff already live in form.js's `submit:`
// convention: a real link that happens to start with the literal text
// "cta:" would also be misread — not a new risk this introduces.)
const CTA_PREFIX = /^\s*cta:\s*/i;

const findCtaTextNode = (links) => links
  .flatMap((link) => [...link.childNodes].map((node) => ({ link, node })))
  .find(({ node }) => node.nodeType === Node.TEXT_NODE && CTA_PREFIX.test(node.textContent));

const decorateActionsSection = (section) => {
  section.classList.add('actions-section');
  const links = contentLinks(section);
  const match = findCtaTextNode(links);

  if (match) {
    match.node.textContent = match.node.textContent.replace(CTA_PREFIX, '');
    match.link.classList.add('action-primary');
    return;
  }

  links.at(-1)?.classList.add('action-primary');
};

const decorateBrandSection = (section) => {
  section.classList.add('brand-section');
  const brandLink = contentLinks(section)[0];
  if (!brandLink) return;
  const text = [...brandLink.childNodes]
    .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (!text) return;
  brandLink.append(createElement('span', { className: 'brand-text' }, text));
};

// Classify by content shape, never position — see side-by-side.js/footer.js.
// Widget-marker links (`/tools/widgets/{scheme,language,toggle}`) don't count
// as content: nav = the section with the main nav <ul>; brand = the remaining
// section with exactly one real link (the logo, even if a hamburger marker
// sits next to it); actions = whatever's left. decorateActionsSection() picks
// the primary CTA — a `cta:`-prefixed link if one exists, else the last real
// actions link (widgets never steal the stamp either way).
const decorateHeaderContent = async (fragment) => {
  const sections = [...fragment.querySelectorAll(':scope > .section')];
  const navSection = sections.find((s) => s.querySelector('ul'));
  const brandSection = sections.find((s) => s !== navSection && contentLinks(s).length === 1);
  const actionsSection = sections.find((s) => s !== navSection && s !== brandSection);

  if (brandSection) decorateBrandSection(brandSection);
  if (navSection) await decorateNavSection(navSection);
  if (actionsSection) decorateActionsSection(actionsSection);

  await decorateWidgets(fragment);
  const toggle = fragment.querySelector('.action-wrapper.toggle');
  if (toggle) brandSection?.querySelector('.default-content')?.append(toggle);
};

export default async (el) => {
  if (!guardDecorate(el, 'headerDecorated')) return;

  const { locale } = getConfig();
  const fragment = await loadFragmentWithFallback([`${locale.prefix}${HEADER_PATH}`, HEADER_PATH]);
  fragment.classList.add('header-content');
  await decorateHeaderContent(fragment);
  el.append(fragment);
};
