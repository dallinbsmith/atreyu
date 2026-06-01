import { onReveal } from '../../scripts/utils/motion.js';

const asset = (file) => new URL(file, import.meta.url).href;

export default (el) => {
  const videoSrc = el.querySelector('a')?.href || asset('bookend-glow.mp4');
  const poster = el.querySelector('img')?.src || asset('bookend-glow.jpg');

  el.replaceChildren();
  const media = document.createElement('div');
  media.className = 'footer-glow-media';
  media.setAttribute('aria-hidden', 'true');
  const glow = document.createElement('div');
  glow.className = 'footer-glow-gradient';
  glow.setAttribute('aria-hidden', 'true');
  el.append(media, glow);

  // onReveal gates on shouldAnimate(): reduced-motion/save-data/low-end → poster only
  onReveal(el, ({ immediate }) => {
    if (immediate) {
      const img = document.createElement('img');
      img.src = poster;
      img.alt = '';
      media.append(img);
      return;
    }
    const video = document.createElement('video');
    Object.assign(video, {
      muted: true, loop: true, autoplay: true, playsInline: true, poster,
    });
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.src = videoSrc;
    media.append(video);
  });
};
