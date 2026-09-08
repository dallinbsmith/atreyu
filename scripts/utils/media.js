// Shared video-behind-poster-image decoration: an author-authored `picture`
// wrapped in a link to an `.mp4` file becomes a looping muted video, gated by
// shouldAnimate() (reduced-motion/save-data/low-end stays on the static
// poster frame — the link is unwrapped, not removed, so the picture itself
// survives). A `data-title="...data-focal:x,y"` on the `img` sets a custom
// object-position focal point. Extracted from hero.js (2026-09-08) once
// hero-screen.js needed the identical behavior — see blocks.md's
// code-organization rule on checking for reuse before reimplementing.
//
// WCAG 2.2.2: shouldAnimate() only gates whether the video starts — any
// continuous motion still needs a user-operable pause control, so every
// caller gets one here rather than each block re-adding its own (see
// logo-wall.js for the same requirement on a different motion type).
// decorateVideoMedia() itself stays synchronous and never awaits the toggle:
// ak.js keeps a whole section hidden until every block's decorate() resolves,
// and the toggle's i18n label lookup is a network fetch with no timeout — it
// must never gate section reveal / LCP. addVideoPauseControl() is exported
// separately so it can still be awaited directly in tests.
import { shouldAnimate, addPauseToggle } from './motion/motion.js';
import { getPlaceholder } from './placeholders.js';

const setBackgroundFocus = (img) => {
  const { title } = img.dataset;
  if (!title?.includes('data-focal')) return;
  delete img.dataset.title;
  const [x, y] = title.split(':')[1].split(',');
  img.style.objectPosition = `${x}% ${y}%`;
};

export const addVideoPauseControl = async (bg, video, onToggle) => {
  const [pause, play] = await Promise.all([
    getPlaceholder('videoPause', 'Pause'),
    getPlaceholder('videoPlay', 'Play'),
  ]);
  addPauseToggle(bg, video, {
    className: 'video-pause-toggle',
    labels: { pause, play },
    onToggle: (paused) => {
      onToggle(paused);
      if (paused) video.pause();
      else video.play().catch(() => {}); // autoplay-policy rejection is not an error
    },
  });
};

export const decorateVideoMedia = (bg) => {
  const bgPic = bg.querySelector('picture');
  if (!bgPic) return;

  const img = bgPic.querySelector('img');
  setBackgroundFocus(img);

  const vidLink = bgPic.closest('a[href*=".mp4"]');
  if (!vidLink) return;
  if (!shouldAnimate()) {
    vidLink.replaceWith(bgPic);
    return;
  }

  // Tracks a user's pause click that lands before `canplay` fires — without
  // this, canplay's unconditional play() would silently resume playback and
  // desync the toggle's displayed state from actual playback.
  let userPaused = false;
  const video = document.createElement('video');
  video.src = vidLink.href;
  video.loop = true;
  video.muted = true;
  video.inert = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'none');
  video.load();
  video.addEventListener('canplay', () => {
    bgPic.remove();
    if (!userPaused) video.play().catch(() => {});
  }, { once: true });
  vidLink.parentElement.append(video, bgPic);
  vidLink.remove();

  // Deliberately not awaited (see header comment) — matches this project's
  // own fire-and-forget idiom elsewhere (ak.js's loadIcons, lazy.js's
  // dynamic imports), which all mark a detached call with a trailing
  // .catch()/.then() rather than a bare call indistinguishable from a
  // forgotten `await`. fetchData() never actually rejects today, but this
  // is defense-in-depth against that changing later without anyone touching
  // this call site.
  addVideoPauseControl(bg, video, (paused) => { userPaused = paused; }).catch(() => {});
};
