import { withGsap } from '../../scripts/utils/gsap-loader.js';
import { shouldAnimate } from '../../scripts/utils/motion.js';

const buildCard = () => {
  const card = document.createElement('div');
  card.className = 'qi-hover';
  card.setAttribute('aria-hidden', 'true');
  const inner = document.createElement('div');
  inner.className = 'qi-hover-inner';
  const media = document.createElement('div');
  media.className = 'qi-hover-media';
  const logo = document.createElement('div');
  logo.className = 'qi-hover-logo';
  const plus = document.createElement('div');
  plus.className = 'qi-hover-plus';
  plus.textContent = '+';
  inner.append(media, logo, plus);
  card.append(inner);
  return card;
};

export const initHover = (blockEl, tabs, slides, mql) => {
  if (!mql.matches || !shouldAnimate()) return;

  const card = buildCard();
  const inner = card.querySelector('.qi-hover-inner');
  const tabsEl = blockEl.querySelector('.qi-tabs');
  blockEl.append(card);
  let active = -1;

  tabsEl.addEventListener('mousemove', (e) => {
    card.style.setProperty('--hover-x', `${e.clientX}px`);
    card.style.setProperty('--hover-y', `${e.clientY}px`);
  });

  tabs.forEach((tab, i) => {
    tab.addEventListener('mouseenter', () => {
      if (i === active) return;
      const wasHidden = active < 0;
      active = i;
      card.querySelector('.qi-hover-media').replaceChildren(
        slides[i].pic?.cloneNode(true) ?? '',
      );
      card.querySelector('.qi-hover-logo').replaceChildren(
        slides[i].icon?.cloneNode(true) ?? '',
      );
      if (!wasHidden) return;
      withGsap(({ gsap }) => {
        gsap.to(card, {
          '--hover-progress': 1, duration: 0.35, ease: 'power2.out', overwrite: true,
        });
        gsap.fromTo(
          inner,
          { '--scale-y': 0.1, '--inner-scale-y': 2 },
          { '--scale-y': 1, '--inner-scale-y': 1, duration: 0.3, ease: 'power2.out' },
        );
      });
    });
  });

  tabsEl.addEventListener('mouseleave', () => {
    active = -1;
    withGsap(({ gsap }) => {
      gsap.to(card, {
        '--hover-progress': 0, duration: 0.3, ease: 'power2.out', overwrite: true,
      });
      gsap.to(inner, {
        '--scale-y': 0.5, '--inner-scale-y': 2, duration: 0.3, ease: 'power2.out',
      });
    });
  });
};
