import { announce } from '../a11y.js';
import { wireModalClose, openModal, closeModal } from './modal.js';

// Matches https://{account}.wistia.com/medias/{id} or fast.wistia.net/embed/iframe/{id}
export const WISTIA_RE = /wistia\.(?:com|net)\/(?:medias|embed\/iframe)\/([\w-]+)/i;

let modal = null;
let releaseTrap = null;
let trigger = null;

const close = () => {
  if (!modal) return;
  closeModal(modal, releaseTrap, trigger);
  modal = null;
  releaseTrap = null;
  trigger = null;
};

const buildModal = (wistiaId, title, signal) => {
  const el = document.createElement('div');
  el.className = 'video-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', title || 'Video');

  const backdrop = document.createElement('div');
  backdrop.className = 'video-modal-backdrop';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'video-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', close, { signal });

  const iframe = document.createElement('iframe');
  iframe.className = 'video-modal-iframe';
  iframe.src = `https://fast.wistia.net/embed/iframe/${encodeURIComponent(wistiaId)}?autoPlay=true`;
  iframe.title = title || 'Video';
  iframe.allow = 'autoplay; fullscreen';
  iframe.allowFullscreen = true;

  const content = document.createElement('div');
  content.className = 'video-modal-content';
  content.append(closeBtn, iframe);
  el.append(backdrop, content);

  wireModalClose(el, backdrop, close, { signal });

  return el;
};

export const openVideoModal = (wistiaId, title, triggerEl, { signal } = {}) => {
  if (signal?.aborted || modal) return;
  modal = buildModal(wistiaId, title, signal);
  trigger = triggerEl;
  releaseTrap = openModal(modal, '.video-modal-close', {
    signal,
    onAbort: () => {
      modal = null;
      releaseTrap = null;
      trigger = null;
    },
  });
  announce(`${title || 'Video'} opened`);
};

// Finds a Wistia link inside `container` and wires it to open the modal
// instead of navigating — shared by any block with a "Watch the Video" CTA
// (hero.js, hero-screen.js) rather than each reimplementing the same find/wire.
export const wireVideoModalLinks = (container, { signal } = {}) => {
  const link = [...container.querySelectorAll('a')].find((a) => WISTIA_RE.test(a.href));
  if (!link) return;
  const [, id] = link.href.match(WISTIA_RE);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openVideoModal(id, link.textContent.trim(), link, { signal });
  }, { signal });
};
