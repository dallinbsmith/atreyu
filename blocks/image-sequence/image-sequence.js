// "Prompter" / manifesto block — a faithful take on Frame.io's scroll-scrubbed
// module: a tall section pins a 100vh stage while large prompter text lights up
// word-by-word, driven by scroll position (not a one-shot entry animation). An
// authored video is scrubbed frame-accurately to the same progress. The reveal
// lives in CSS off a single `--progress` custom property; JS only emits the
// number and nudges `video.currentTime`. Reduced motion / save-data falls back
// to fully-lit static text (the resting state) via the shared engine's no-op.
import { shouldAnimate } from '../../scripts/utils/motion.js';
import { trackScrollProgress } from '../../scripts/utils/scroll.js';

// Scrub an authored video to scroll progress. Browsers can't seek a not-yet-
// buffered frame, so we guard on readiness and only seek on meaningful deltas
// to avoid thrashing the decoder (keeps the scrub smooth and INP-friendly).
const scrubVideo = (video) => {
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.removeAttribute('autoplay');
  video.pause();
  return (p) => {
    if (!video.duration) return;
    const t = p * video.duration;
    if (Math.abs(video.currentTime - t) > 0.02) video.currentTime = t;
  };
};

export default (el) => {
  el.classList.add('prompter');
  const text = el.querySelector('h1, h2, h3, p');
  if (!text) return;
  text.classList.add('prompter-text');

  const video = el.querySelector('video');
  video?.closest('p')?.classList.add('prompter-media');

  if (!shouldAnimate()) return;
  el.classList.add('prompter-scrub');

  const words = text.textContent.trim().split(/\s+/);
  text.textContent = '';
  text.style.setProperty('--count', words.length);
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'prompter-word';
    span.textContent = word;
    span.style.setProperty('--i', i);
    text.append(span, document.createTextNode(' '));
  });

  const seek = video ? scrubVideo(video) : null;
  trackScrollProgress(el, seek);
};
