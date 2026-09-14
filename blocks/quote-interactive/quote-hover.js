import { getConfig } from '../../scripts/ak.js';
import { createElement } from '../../scripts/utils/dom.js';
import { listenGroup } from '../../scripts/utils/listen.js';
import { loadGsap } from '../../scripts/utils/motion/gsap-loader.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';

const EASE = 'power2.out';

// Module scope, not per-el: the hover card lives on document.body, OUTSIDE the
// block's own subtree, so it (and its listeners/rAF) survive a DA Quick Edit
// DOM swap and would duplicate on re-decoration. Nothing re-runs against the
// OLD el to clean it up, so the teardown handle can't hang off el — it lives
// here and is aborted before each new run. See scripts.md's Block Lifecycle.
let teardownHover = null;

const buildCard = () => {
  const media = createElement('div', { className: 'qi-hover-media' });
  const logo = createElement('div', { className: 'qi-hover-logo' });
  const inner = createElement(
    'div',
    { className: 'qi-hover-inner' },
    media,
    logo,
    createElement('div', { className: 'qi-hover-plus' }, '+'),
  );
  const card = createElement('div', {
    className: 'qi-hover', 'aria-hidden': 'true',
  }, inner);
  return { card, inner, media, logo };
};

const fill = (host, node) => host.replaceChildren(node?.cloneNode(true) ?? '');

// One style write per frame, same rAF-coalesce as scripts/utils/motion/scroll.js.
// Returns a canceller for the pending frame — rAF isn't AbortSignal-aware, so
// the group's signal can't drop it; teardown calls this explicitly.
const trackPointer = (el, card, listen) => {
  let raf = 0;
  let pointer = null;
  listen(el, 'mousemove', (e) => {
    pointer = e;
    raf ||= requestAnimationFrame(() => {
      raf = 0;
      card.style.setProperty('--hover-x', `${pointer.clientX}px`);
      card.style.setProperty('--hover-y', `${pointer.clientY}px`);
    });
  });
  return () => { if (raf) cancelAnimationFrame(raf); };
};

// Sync half (mount + pointer tracking) runs before the first await, so tests
// can assert the card is in the DOM as soon as initHover is invoked. Async
// half wires GSAP; null core (shouldAnimate flipped, or load failed) leaves
// the card mounted-but-invisible via CSS defaults.
export const initHover = async (blockEl, tabs, slides, mql) => {
  // Tear down a prior run's out-of-subtree resources before starting a new
  // one (or before bailing) — the only reliable point to do so, since the old
  // el is discarded on re-decoration and never re-run. Harmless if the old
  // card was already removed by a full-body swap: remove() no-ops on a
  // detached node, abort() no-ops on an already-settled controller.
  teardownHover?.();
  teardownHover = null;

  if (!mql.matches || !shouldAnimate()) return;

  const { card, inner, media, logo } = buildCard();
  document.body.append(card);
  const group = listenGroup();
  const tabsEl = blockEl.querySelector('.qi-tabs');
  const cancelRaf = trackPointer(tabsEl, card, group.listen);
  teardownHover = () => {
    group.end();
    cancelRaf();
    card.remove();
  };

  const core = await loadGsap().catch((ex) => {
    getConfig().log(ex);
    return null;
  });
  if (!core) return;
  const { gsap } = core;
  const to = (el, vars) => gsap.to(el, { ease: EASE, ...vars });

  let active = -1;
  tabs.forEach((tab, i) => {
    group.listen(tab, 'mouseenter', () => {
      if (i === active) return;
      const reveal = active < 0;
      active = i;
      fill(media, slides[i].pic);
      fill(logo, slides[i].icon);
      if (!reveal) return;
      to(card, { '--hover-progress': 1, duration: 0.35, overwrite: true });
      gsap.fromTo(
        inner,
        { '--scale-y': 0.1, '--inner-scale-y': 2 },
        { '--scale-y': 1, '--inner-scale-y': 1, duration: 0.3, ease: EASE },
      );
    });
  });

  group.listen(tabsEl, 'mouseleave', () => {
    active = -1;
    to(card, { '--hover-progress': 0, duration: 0.3, overwrite: true });
    to(inner, { '--scale-y': 0.5, '--inner-scale-y': 2, duration: 0.3 });
  });
};
