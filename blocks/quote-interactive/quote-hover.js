import { getConfig } from '../../scripts/ak.js';
import { createElement } from '../../scripts/utils/dom.js';
import { loadGsap } from '../../scripts/utils/motion/gsap-loader.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';

const EASE = 'power2.out';

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
const trackPointer = (el, card) => {
  let raf = 0;
  let pointer = null;
  el.addEventListener('mousemove', (e) => {
    pointer = e;
    raf ||= requestAnimationFrame(() => {
      raf = 0;
      card.style.setProperty('--hover-x', `${pointer.clientX}px`);
      card.style.setProperty('--hover-y', `${pointer.clientY}px`);
    });
  });
};

// Sync half (mount + pointer tracking) runs before the first await, so tests
// can assert the card is in the DOM as soon as initHover is invoked. Async
// half wires GSAP; null core (shouldAnimate flipped, or load failed) leaves
// the card mounted-but-invisible via CSS defaults.
export const initHover = async (blockEl, tabs, slides, mql) => {
  if (!mql.matches || !shouldAnimate()) return;

  const { card, inner, media, logo } = buildCard();
  document.body.append(card);
  const tabsEl = blockEl.querySelector('.qi-tabs');
  trackPointer(tabsEl, card);

  const core = await loadGsap().catch((ex) => {
    getConfig().log(ex);
    return null;
  });
  if (!core) return;
  const { gsap } = core;
  const to = (el, vars) => gsap.to(el, { ease: EASE, ...vars });

  let active = -1;
  tabs.forEach((tab, i) => {
    tab.addEventListener('mouseenter', () => {
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

  tabsEl.addEventListener('mouseleave', () => {
    active = -1;
    to(card, { '--hover-progress': 0, duration: 0.3, overwrite: true });
    to(inner, { '--scale-y': 0.5, '--inner-scale-y': 2, duration: 0.3 });
  });
};
