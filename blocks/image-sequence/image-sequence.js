// "Prompter" / manifesto block. Frame.io's module scrubs a canvas/video frame
// sequence to scroll position with large prompter text lighting up word-by-word.
// EDS has no build step or scroll-scrubbing primitive, so we approximate with a
// word-by-word reveal on entry (motion-gated, static fallback). The real
// frame-sequence scrub is the documented shortcoming — see eds-poc-findings.
import { shouldAnimate, onReveal } from '../../scripts/utils/motion.js';

export default (el) => {
  el.classList.add('prompter');
  const text = el.querySelector('h1, h2, h3, p');
  if (!text) return;
  text.classList.add('prompter-text');

  if (!shouldAnimate()) return;
  el.classList.add('prompter-anim');

  const words = text.textContent.trim().split(/\s+/);
  text.textContent = '';
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'prompter-word';
    span.textContent = word;
    span.style.setProperty('--i', i);
    text.append(span, document.createTextNode(' '));
  });

  onReveal(el, () => el.classList.add('lit'), { threshold: 0.35 });
};
