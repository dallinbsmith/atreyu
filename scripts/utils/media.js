// Shared video-behind-poster-image decoration: an author-authored `picture`
// wrapped in a link to an `.mp4` file becomes a looping muted video, gated by
// shouldAnimate() (reduced-motion/save-data/low-end stays on the static
// poster frame — the link is unwrapped, not removed, so the picture itself
// survives). A `data-title="...data-focal:x,y"` on the `img` sets a custom
// object-position focal point. Extracted from hero.js (2026-09-08) once
// hero-screen.js needed the identical behavior — see blocks.md's
// code-organization rule on checking for reuse before reimplementing.
import { shouldAnimate } from './motion/motion.js';

const setBackgroundFocus = (img) => {
  const { title } = img.dataset;
  if (!title?.includes('data-focal')) return;
  delete img.dataset.title;
  const [x, y] = title.split(':')[1].split(',');
  img.style.objectPosition = `${x}% ${y}%`;
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
  const video = document.createElement('video');
  video.src = vidLink.href;
  video.loop = true;
  video.muted = true;
  video.inert = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'none');
  video.load();
  video.addEventListener('canplay', () => {
    video.play();
    bgPic.remove();
  });
  vidLink.parentElement.append(video, bgPic);
  vidLink.remove();
};
