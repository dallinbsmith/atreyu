import { decorateTout } from '../../scripts/utils/touts.js';

// Lift an authored image out as card media (before tout decoration so it isn't
// treated as body). Large landscape images become a full-bleed BACKGROUND with
// text overlaid (Frame.io's `backgroundOnly` cards); small images render as a
// FOREGROUND icon above the text (`foregroundOnly`). Mirrors the bentoMediaLayout
// field, but inferred from the image so authors just drop in the right asset.
const placeMedia = (card) => {
  const pic = card.querySelector('picture, img');
  if (!pic) return null;
  const img = card.querySelector('img');
  const w = img ? Number.parseInt(img.getAttribute('width'), 10) || img.naturalWidth || 0 : 0;
  // Photos (jpg) fill the card as a full-bleed background with text overlaid
  // (Frame.io `backgroundOnly`); graphics/logos/UI (png, transparent) render as
  // foreground media above the text (`foregroundOnly`). Width is a fallback.
  const src = img?.getAttribute('src') ?? '';
  const isPhoto = /\.jpe?g($|\?)/i.test(src) || /format=(jpe?g|pjpg)/i.test(src);
  const layout = (isPhoto || w >= 1000) ? 'bg' : 'icon';
  if (layout === 'bg' && img) img.alt = ''; // full-bleed bg is decorative; text carries meaning
  const host = pic.closest('p') ?? pic;
  const media = document.createElement('div');
  media.className = `bento-card-media ${layout}`;
  media.append(pic.closest('picture') ?? pic);
  if (host !== card && host.parentElement === card && !host.textContent.trim()) host.remove();
  card.dataset.media = layout;
  return media;
};

export default (el) => {
  [...el.children].forEach((row) => {
    row.classList.add('bento-grid');
    const cards = [...row.children];
    row.style = `--card-count: ${cards.length}`;
    cards.forEach((card) => {
      const media = placeMedia(card);
      decorateTout(card, 'bento-card');
      if (media) card.prepend(media);
    });
  });
};
