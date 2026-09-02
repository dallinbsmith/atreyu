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
};

const buildModal = (wistiaId, title) => {
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
  closeBtn.addEventListener('click', close);

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

  wireModalClose(el, backdrop, close);

  return el;
};

export const openVideoModal = (wistiaId, title, triggerEl) => {
  if (modal) return;
  modal = buildModal(wistiaId, title);
  trigger = triggerEl;
  releaseTrap = openModal(modal, '.video-modal-close');
  announce(`${title || 'Video'} opened`);
};
