// Falkor's module.cardGridEditorial: a grid of image+heading+link cards, the
// whole card is one link (real button text is just the link's own label, not
// a second interactive element). One authored row = one card; image, heading
// and link are found by content shape, not position, so authors can order a
// card's cells however they like. A second picture in the same row is the
// optional brand-logo overlay, not a second content image — distinguished
// from the main photo the same way carousel.js/bentos.js already do
// (inferMediaLayout: a full photo reads as background, a small graphic reads
// as foreground/logo), never by which picture was authored first.
import { inferMediaLayout } from '../../scripts/utils/touts.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { onReveal } from '../../scripts/utils/motion/motion.js';
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';

// Falkor shows 6 cards and hides the rest behind a "Show more" toggle.
const DEFAULT_VISIBLE = 6;

const buildCard = (row, idx) => {
  const link = row.querySelector('a');
  const heading = row.querySelector(HEADING_SELECTOR);
  if (!link || !heading) return null;

  // Every picture that reads as a real photo is main-image material; only one
  // wins (first authored), any extra real photos are dropped rather than
  // misread as a logo — a second full photo is an authoring mistake, not a
  // second logo (mirrors carousel.js's buildSlide: keep first, detach rest).
  const pics = [...row.querySelectorAll('picture')];
  const backgrounds = pics.filter((p) => inferMediaLayout(p.querySelector('img')) === 'background');
  const main = backgrounds[0] ?? pics[0];
  const logo = pics.find((p) => p !== main && !backgrounds.includes(p));

  const media = main ? createElement('div', { className: 'cge-media' }, main, logo) : null;
  if (logo) logo.classList.add('cge-logo');
  heading.classList.add('cge-title');
  const cta = createElement('span', { className: 'cge-cta' }, link.textContent.trim());

  // Reuse the real, already-decorated <a> rather than rebuilding a parallel
  // one — ak.js's decorateLink()/decorateButton() already ran on it (e.g. the
  // rel="noopener noreferrer" it sets on an external href), and a fresh
  // createElement('a', ...) would silently drop that treatment. But
  // decorateButton() may ALSO have added btn/btn-primary/etc (if the CTA text
  // was authored with **bold**/*italic* emphasis) — those bring their own
  // padding/border/border-radius that would otherwise wrap the whole card in
  // an unwanted button box. Full reset, not classList.add, so the card is
  // ONLY ever styled as a card, regardless of what ran on this <a> before.
  link.className = 'cge-card';
  link.dataset.testid = `card-grid-editorial-card-${idx}`;
  link.replaceChildren(...[media, heading, cta].filter(Boolean));
  return link;
};

export default async (el) => {
  if (el.dataset.cge) return;
  el.dataset.cge = 'true';

  const cards = [...el.children].map(buildCard).filter(Boolean);
  el.replaceChildren(...cards);
  onReveal(el, () => el.classList.add('cge-in'));
  if (cards.length <= DEFAULT_VISIBLE) return;

  cards.slice(DEFAULT_VISIBLE).forEach((card) => card.classList.add('cge-hidden'));
  const [more, less] = await Promise.all([
    getPlaceholder('cardGridEditorialShowMore', 'Show more'),
    getPlaceholder('cardGridEditorialShowLess', 'Show less'),
  ]);

  const toggle = createElement('button', {
    type: 'button', className: 'cge-toggle', 'aria-expanded': 'false',
  }, more);
  let expanded = false;
  toggle.addEventListener('click', () => {
    const expanding = !expanded;
    expanded = expanding;
    // Move focus off a card that's about to leave the layout/a11y tree
    // (display: none) BEFORE hiding it — the browser doesn't auto-blur it,
    // which would otherwise strand focus on an invisible, unreachable card.
    const hidden = cards.slice(DEFAULT_VISIBLE);
    if (!expanding && hidden.some((c) => c.contains(document.activeElement))) toggle.focus();
    toggle.setAttribute('aria-expanded', String(expanding));
    toggle.textContent = expanding ? less : more;
    hidden.forEach((card) => card.classList.toggle('cge-hidden', !expanding));
    if (expanding) cards[DEFAULT_VISIBLE].focus();
  });
  el.append(toggle);
};
