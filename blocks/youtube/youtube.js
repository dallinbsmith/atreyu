import { inject } from '../../scripts/utils/seo/jsonld.js';
import { createElement } from '../../scripts/utils/dom.js';
import { loadSvg } from '../../scripts/utils/glyphs.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

const THUMB_BASE = 'https://i.ytimg.com/vi';
const EMBED_BASE = 'https://www.youtube-nocookie.com/embed';
const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

const thumb = (id, size = 'maxresdefault') => `${THUMB_BASE}/${encodeURIComponent(id)}/${size}.jpg`;

const injectVideoLd = (id, title) => inject({
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: title,
  embedUrl: `${EMBED_BASE}/${encodeURIComponent(id)}`,
  thumbnailUrl: thumb(id),
  // uploadDate intentionally omitted: an empty string is invalid per Google's
  // VideoObject spec and can suppress the rich result. Add it back only with a
  // real authored date source, never a placeholder value.
  contentUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
});

export default async (a) => {
  const params = new URLSearchParams(a.search);
  const id = params.get('v') || a.pathname.split('/').pop();
  const [fallbackTitle, playLabel] = await Promise.all([
    getPlaceholder('youtubeTitle', 'YouTube Video'),
    getPlaceholder('youtubePlay', 'Play {title}'),
  ]);
  const title = a.textContent.trim() || fallbackTitle;
  params.delete('v');
  params.set('rel', '0');

  const img = createElement('img', {
    src: thumb(id),
    alt: title,
    loading: 'lazy',
    width: 1280,
    height: 720,
  });
  img.addEventListener('error', () => { img.src = thumb(id, 'hqdefault'); }, { once: true });

  const btn = createElement('button', {
    className: 'youtube-play',
    'aria-label': playLabel.replace('{title}', title),
  }, await loadSvg(new URL('./play.svg', import.meta.url).href));

  const container = createElement('div', { className: 'youtube-lite' }, img, btn);
  const play = () => {
    params.set('autoplay', '1');
    const iframe = createElement('iframe', {
      src: `${EMBED_BASE}/${encodeURIComponent(id)}?${params}`,
      title,
      allow: IFRAME_ALLOW,
      allowfullscreen: true,
    });
    container.replaceChildren(iframe);
  };
  container.addEventListener('click', play, { once: true });

  a.replaceWith(container);
  injectVideoLd(id, title);
};
