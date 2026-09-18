// Vanilla port of Falkor's Speedbump module — a full-bleed rounded media card
// with text over it, optionally clickable as a whole card. Real content
// (checked directly against the live Sanity dataset, 2026-09-15): 55 real
// instances, 28 of which embed exactly one link in the content — Falkor's own
// extraction logic (getLinkFromPortableText) only promotes that link to a
// whole-card link when there is EXACTLY one; 2+ links leaves them as plain
// inline links instead, so this mirrors that same one-link-only rule rather
// than guessing at multi-link intent.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import {
  createElement, getCells, HEADING_SELECTOR,
} from '../../scripts/utils/dom.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  if (!guardDecorate(el, 'speedbump')) return;

  // Cell, not row: a picture cell with a sibling text cell must not sweep
  // that sibling into the media wrapper. Same F-66 pattern as hero.js.
  const cells = getCells(el);
  const picCell = cells.find((c) => c.querySelector('picture'));
  const extra = cells.filter((c) => c !== picCell);

  const content = createElement('div', { className: 'speedbump-content' });
  extra.forEach((cell) => content.append(...cell.children));
  content.querySelector(HEADING_SELECTOR)?.classList.add('speedbump-title');
  decorateRichText(content);

  // Falkor: extracts a link from the content and promotes it to wrap the
  // whole card, ONLY when there's exactly one (button.length === 1) — its own
  // stated reason is ambiguity with more than one. The extracted link's own
  // text stays visible as plain text (Falkor's "interactionRemoved" flag);
  // it does not render as a second, separately-clickable link once the
  // whole card already is one. Unwrap and promotion are decided from the
  // SAME cardHref value — an empty/missing href leaves the link inline
  // instead of silently deleting it (unwrapping unconditionally on
  // links.length === 1 alone, while promoting only when cardHref is
  // truthy, would destroy an author's only link with nothing to show for it).
  const links = [...content.querySelectorAll('a')];
  const [onlyLink] = links.length === 1 ? links : [];
  const cardHref = onlyLink?.getAttribute('href') || undefined;
  if (cardHref) onlyLink.replaceWith(...onlyLink.childNodes);

  const media = picCell && createElement(
    'div',
    { className: 'speedbump-media', 'aria-hidden': 'true' },
    ...picCell.children,
  );
  // Decorative once text is laid over it (see speedbump.css's scrim) — same
  // shape and reasoning as pothole/decorate.js's identical treatment.
  if (media) {
    const img = media.querySelector('img');
    if (img) img.alt = '';
  }

  const card = createElement(
    cardHref ? 'a' : 'div',
    { className: 'speedbump-card', href: cardHref, 'data-testid': 'speedbump-card' },
    media,
    content,
  );
  el.replaceChildren(card);

  // Sets --progress (0..1) on el as it scrolls through the viewport; CSS reads
  // it on the media <img> for the parallax shift. No-op under reduced motion
  // (--progress stays unset, CSS's var(--progress, 0) fallback keeps it still).
  trackScrollProgress(el);
};
