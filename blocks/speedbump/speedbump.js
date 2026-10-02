// Full-bleed media card promotes the authored link to wrap the card; keep
// the static media/text structure usable without motion.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import {
  createElement, getCells, HEADING_SELECTOR,
} from '../../scripts/utils/dom.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el, { signal } = {}) => {
  if (signal?.aborted || !guardDecorate(el, 'speedbump')) return;

  // Cell, not row: a picture cell with sibling text must not sweep the whole
  // row into the media slot.
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
  // shape and reasoning as pothole.js's identical treatment.
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
  trackScrollProgress(el, undefined, { signal });
};
