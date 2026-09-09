import { onReveal, addPauseToggle } from '../../scripts/utils/motion/motion.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

const asset = (file) => new URL(file, import.meta.url).href;

export default (el) => {
  if (el.dataset.footerGlow) return;
  el.dataset.footerGlow = 'true';

  // Row-scoped, not whole-block: this is a single optional override row
  // (video link + poster image), so we only ever look inside it — never at
  // whatever el.replaceChildren() builds below on a later pass.
  const row = el.querySelector(':scope > div');
  const videoSrc = row?.querySelector('a')?.href || asset('bookend-glow.mp4');
  const poster = row?.querySelector('img')?.src || asset('bookend-glow.jpg');

  el.replaceChildren();
  const media = document.createElement('div');
  media.className = 'footer-glow-media';
  media.setAttribute('aria-hidden', 'true');
  const glow = document.createElement('div');
  glow.className = 'footer-glow-gradient';
  glow.setAttribute('aria-hidden', 'true');
  el.append(media, glow);

  // onReveal gates on shouldAnimate(): reduced-motion/save-data/low-end → poster only
  onReveal(el, async ({ immediate }) => {
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

    // WCAG 2.2.2 (Pause, Stop, Hide): shouldAnimate() only gates whether this
    // continuous loop starts — it still needs its own user-operable pause
    // control. Only wired here, in the branch that actually builds the
    // video — the static-poster branch above has nothing to pause.
    const [pause, play] = await Promise.all([
      getPlaceholder('footerGlowPause', 'Pause'),
      getPlaceholder('footerGlowPlay', 'Play'),
    ]);
    addPauseToggle(el, video, {
      className: 'footer-glow-toggle',
      labels: { pause, play },
      onToggle: (paused) => (paused ? video.pause() : video.play()),
    });
  });
};
