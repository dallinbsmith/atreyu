import { inject } from '../../scripts/utils/jsonld.js';

const THUMB_BASE = 'https://i.ytimg.com/vi';
const EMBED_BASE = 'https://www.youtube-nocookie.com/embed';
const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';

const playSvg = () => `<svg viewBox="0 0 68 48" aria-hidden="true">
  <path class="youtube-play-bg" d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"/>
  <path class="youtube-play-icon" d="M45 24 27 14v20z"/>
</svg>`;

const loadIframe = (container, id, params, title) => {
  params.set('autoplay', '1');
  const iframe = document.createElement('iframe');
  iframe.src = `${EMBED_BASE}/${encodeURIComponent(id)}?${params}`;
  iframe.title = title;
  iframe.allow = IFRAME_ALLOW;
  iframe.allowFullscreen = true;
  container.replaceChildren(iframe);
};

const injectVideoLd = (id, title) => {
  inject({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    embedUrl: `${EMBED_BASE}/${id}`,
    thumbnailUrl: `${THUMB_BASE}/${id}/maxresdefault.jpg`,
    uploadDate: '',
    contentUrl: `https://www.youtube.com/watch?v=${id}`,
  });
};

export default (a) => {
  const params = new URLSearchParams(a.search);
  const id = params.get('v') || a.pathname.split('/').pop();
  const title = a.textContent.trim() || 'YouTube Video';
  params.delete('v');
  params.set('rel', '0');

  const container = document.createElement('div');
  container.className = 'youtube-lite';

  const img = document.createElement('img');
  img.src = `${THUMB_BASE}/${encodeURIComponent(id)}/maxresdefault.jpg`;
  img.alt = title;
  img.loading = 'lazy';
  img.width = 1280;
  img.height = 720;
  img.onerror = () => { img.src = `${THUMB_BASE}/${encodeURIComponent(id)}/hqdefault.jpg`; };

  const btn = document.createElement('button');
  btn.className = 'youtube-play';
  btn.setAttribute('aria-label', `Play ${title}`);
  btn.innerHTML = playSvg();

  container.append(img, btn);
  container.addEventListener('click', () => loadIframe(container, id, params, title), { once: true });
  a.parentElement.replaceChild(container, a);

  injectVideoLd(id, title);
};
