// Scroll-scrubbed prompter (authored as the image-sequence block): a tall
// section pins a 100vh stage while text lights up word-by-word off `--progress`.
// An authored video is seeked to the same progress. Reduced motion / save-data
// keeps the resting (fully lit) layout via shouldAnimate().
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';

const MP4 = /\.mp4(\?|#|$)/i;
const SEEK_EPS = 0.02;

const prepareScrub = (video) => {
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.removeAttribute('autoplay');
  video.pause();
};

// preload stays 'metadata' until the first progress tick — decoration is not
// viewport-gated, so 'auto' here would download below-fold videos during Lazy.
// trackScrollProgress's IO (rootMargin: 100%) is that gate. The first tick can
// beat loadedmetadata (homepage: this block sits behind the hero), so we stash
// `last` and seek again when duration appears. Seek-lock waits for `seeked`
// unless currentTime applied synchronously (tests / already-buffered).
const scrubOnProgress = (video) => {
  let last = 0;
  let seeking = false;
  const seek = (p) => {
    last = p;
    if (video.preload !== 'auto') video.preload = 'auto';
    if (!video.duration || seeking) return;
    const t = p * video.duration;
    if (Math.abs(video.currentTime - t) <= SEEK_EPS) return;
    seeking = true;
    video.currentTime = t;
    if (Math.abs(video.currentTime - t) <= SEEK_EPS) seeking = false;
  };
  video.addEventListener('seeked', () => { seeking = false; });
  if (!video.duration) {
    video.addEventListener('loadedmetadata', () => seek(last), { once: true });
  }
  return seek;
};

// DA can't insert <video>; the manifesto clip is an authored .mp4 link.
const findVideo = (el) => {
  const existing = el.querySelector('video');
  if (existing) return existing;
  const href = [...el.querySelectorAll('a')]
    .find((a) => MP4.test(a.getAttribute('href') ?? ''))
    ?.getAttribute('href');
  return href ? createElement('video', { src: href }) : null;
};

const splitWords = (text) => {
  const words = text.textContent.trim().split(/\s+/);
  text.replaceChildren();
  text.style.setProperty('--count', words.length);
  for (const [i, word] of words.entries()) {
    const span = createElement('span', { className: 'prompter-word' }, word);
    span.style.setProperty('--i', i);
    text.append(span, ' ');
  }
};

// Stage is exactly [media?, textwrap]. Extra authored rows are dropped —
// the contract is one heading/p plus an optional video or .mp4 link.
const buildStage = (el, text, video) => {
  text.classList.add('prompter-text');
  const media = video && createElement('div', { className: 'prompter-media' }, video);
  el.replaceChildren(...(media ? [media] : []), createElement('div', {
    className: 'prompter-textwrap',
  }, text));
};

export default (el) => {
  if (el.dataset.imgSeq) return;
  el.dataset.imgSeq = 'true';
  el.classList.add('prompter');

  const text = el.querySelector(`${HEADING_SELECTOR}, p`);
  if (!text) return;

  const video = findVideo(el);
  buildStage(el, text, video);
  if (!shouldAnimate()) {
    if (video) video.controls = true;
    return;
  }
  el.classList.add('prompter-scrub');
  splitWords(text);
  if (video) prepareScrub(video);
  // Cleanup discarded: no client routing, so `el` lives for the page lifetime.
  trackScrollProgress(el, video ? scrubOnProgress(video) : undefined);
};
