// Any block that turns an author-provided URL into an iframe src must check
// it against this allowlist first — a raw-HTML-capable block accepting
// arbitrary embed sources is a real XSS/open-redirect surface (see CME
// Group's iframe.js precedent). This project's existing iframe embeds
// (youtube.js, video-modal.js) don't need this today — they only ever build
// their src from a fixed, hardcoded base plus a regex/encodeURIComponent-
// extracted ID, never an author-supplied URL directly. Add a host here (and
// use isAllowedEmbedHost()) the moment a block accepts a raw embed URL.
export const ALLOWED_EMBED_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'fast.wistia.net',
];

export const isAllowedEmbedHost = (url) => {
  try {
    return ALLOWED_EMBED_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
};
