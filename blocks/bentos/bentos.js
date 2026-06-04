import { decorateTout } from '../../scripts/utils/touts.js';

// Falkor's bentoMediaLayout: photos fill the card as a full-bleed BACKGROUND with
// text overlaid (`background`); graphics/logos render as a FOREGROUND icon above the
// text (`foreground`). Used only as a fallback when authors set no explicit option.
const inferMediaLayout = (img) => {
  const src = img?.getAttribute('src') ?? '';
  const w = Number.parseInt(img?.getAttribute('width'), 10) || img?.naturalWidth || 0;
  const isPhoto = /\.jpe?g($|\?)/i.test(src) || /format=(jpe?g|pjpg)/i.test(src);
  return (isPhoto || w >= 1000) ? 'background' : 'foreground';
};

// DA / Google-Docs fallback: authors set per-card options with a leading config
// line, e.g. "media: background; bg: full; decoration: glassborder". Recognized
// keys map to the same dataset axes the UE selects emit; the line is then removed.
const OPT = {
  media: 'mediaLayout',
  size: 'mediaSize',
  decoration: 'decoration',
  bg: 'bgMode',
  placement: 'textPlacement',
  align: 'textAlign',
};
const SHORT = { both: 'backgroundAndForeground', full: 'fullWidthWithShadows' };
const parseConfig = (card) => {
  const line = [...card.querySelectorAll('p')]
    .find((p) => /^\s*(media|size|decoration|bg|placement|align)\s*[:=]/i.test(p.textContent));
  if (!line) return;
  line.textContent.split(/[;,\n]/).forEach((pair) => {
    const [k, v] = pair.split(/[:=]/).map((s) => s?.trim());
    const key = OPT[k?.toLowerCase()];
    if (key && v) card.dataset[key] = SHORT[v.toLowerCase()] ?? v;
  });
  line.remove();
};

// Lift an authored image out as card media before tout decoration so it isn't
// treated as body. The card's authored options (set by the authoring layer as
// data-attributes, or the DA config line above) drive placement; absent any, we
// infer from the asset.
const placeMedia = (card) => {
  const pic = card.querySelector('picture, img');
  if (!pic) return null;
  const img = card.querySelector('img');
  const layout = card.dataset.mediaLayout ?? inferMediaLayout(img);
  const isBg = layout === 'background' || layout === 'backgroundAndForeground';
  if (isBg && img) img.alt = ''; // full-bleed bg is decorative; text carries meaning
  const host = pic.closest('p') ?? pic;
  const media = document.createElement('div');
  media.className = `bento-card-media ${isBg ? 'bg' : 'fg'}`;
  media.append(pic.closest('picture') ?? pic);
  if (host !== card && host.parentElement === card && !host.textContent.trim()) host.remove();
  card.dataset.mediaLayout = layout;
  return media;
};

// Map authored axes to classes the CSS keys off. Defaults mirror Falkor: text at
// bottom, centre-aligned, background images cover, foreground icons small + bordered.
const applyOptions = (card) => {
  const {
    textPlacement = 'bottom', textAlign = 'center', mediaSize, decoration, bgMode,
  } = card.dataset;
  card.classList.add(`text-${textPlacement}`, `align-${textAlign}`);
  if (mediaSize) card.classList.add(`media-${mediaSize}`);
  if (decoration === 'glassborder') card.classList.add('glassborder');
  if (bgMode) card.dataset.bgMode = bgMode;
};

export default (el) => {
  [...el.children].forEach((row) => {
    row.classList.add('bento-grid');
    const cards = [...row.children];
    row.style = `--card-count: ${cards.length}`;
    cards.forEach((card) => {
      parseConfig(card);
      const media = placeMedia(card);
      applyOptions(card);
      decorateTout(card, 'bento-card');
      if (media) card.prepend(media);
    });
  });
};
