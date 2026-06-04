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

  // Media: an authored <video>, or an authored link to an .mp4 we upgrade to one
  // (DA can't insert a <video>, so the manifesto video is authored as a link).
  let video = el.querySelector('video');
  const link = video ? null
    : [...el.querySelectorAll('a')].find((a) => /\.mp4(\?|#|$)/i.test(a.getAttribute('href') ?? ''));
  if (link) {
    video = document.createElement('video');
    video.src = link.getAttribute('href');
  }
  const media = video && document.createElement('div');
  if (media) {
    media.className = 'prompter-media';
    media.append(video);
  }

  // Flatten to [media?, textwrap] direct children. The text lives inside a
  // wrapper so the wrapper owns the sticky 100vh centering — the text element
  // itself must stay normal flow, or its per-word spans become grid items
  // (one word per line). The -100vh overlap pins text over the video.
  const textwrap = document.createElement('div');
  textwrap.className = 'prompter-textwrap';
  textwrap.append(text);
  el.replaceChildren(...(media ? [media] : []), textwrap);

  // No scroll-scrubbing (reduced motion / save-data / low-end): the text rests
  // fully lit, and the video would otherwise be a dead, control-less element —
  // give it native controls so it stays manually playable.
  if (!shouldAnimate()) {
    if (video) video.controls = true;
    return;
  }
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
