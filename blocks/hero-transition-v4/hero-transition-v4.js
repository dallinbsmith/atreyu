// Vanilla port of Falkor's HeroTransitionV4 module — a single glowing image
// used as a repeated mid-page "reveal" section, not a page-level hero. Real
// content (checked directly against the live Sanity dataset, 2026-09-04) is
// always a single image; 6 of 7 real instances add a glow behind it, one
// omits it (opt out via the `no-glow` variant). This uses a one-shot
// reveal-on-scroll, not the continuous trackScrollProgress() engine
// pothole/pothole-v4 use — that engine assumes a tall, pinned section
// (`scroll.js`'s own doc comment), and this content is a short, normal-flow
// element. Matches hero-cards-transition.js's own onReveal()-for-entrance
// pattern instead.
import { onReveal } from '../../scripts/utils/motion/motion.js';
import { createElement } from '../../scripts/utils/dom.js';

export default (el) => {
  // Row meaning is classified by content shape, never by position: the
  // picture row is whichever row (if any) holds one; any other row's
  // content is merged in rather than silently dropped, in case an author
  // ever adds a stray extra row.
  const rows = [...el.querySelectorAll(':scope > div')];
  const picRow = rows.find((r) => r.querySelector('picture'));
  const pic = picRow?.querySelector('picture');
  if (!pic) return;

  const img = pic.querySelector('img');
  if (img) {
    img.setAttribute('loading', img.getAttribute('loading') ?? 'lazy');
    img.setAttribute('decoding', 'async');
  }

  const media = createElement('div', { className: 'hero-transition-v4-media' }, pic);
  const extra = rows.filter((r) => r !== picRow).flatMap((r) => [...r.children]);
  el.replaceChildren(media, ...extra);

  onReveal(el, () => el.classList.add('is-in'), { threshold: 0 });
};
