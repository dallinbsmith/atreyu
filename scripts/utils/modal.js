import { trapFocus } from './a11y.js';

// Backdrop-click and Escape-key dismissal — wired independently by
// video-modal.js, tile-modal.js, and quote-modal.js before this extraction,
// the same "duplicated block-decoration logic diverges over time" pattern
// CME Group's language-selector/footer split fell into. A modal's own
// additional keydown handling (arrow-key slide navigation, etc.) stays a
// separate listener at the call site — this only owns the two interactions
// every modal in this codebase needs.
export const wireModalClose = (modal, backdrop, close) => {
  backdrop.addEventListener('click', close);
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
};

// The rest of the open/close choreography every modal in this codebase also
// needed, independently reimplemented in video-modal.js/tile-modal.js/
// quote-modal.js beyond just dismissal — same duplication risk as
// wireModalClose above, the extraction just didn't go far enough the first
// time. Each modal keeps its own open-guard, build-vs-reuse decision,
// announce() message, and any entrance/exit animation at the call site —
// those genuinely differ per modal.
export const openModal = (modal, closeSelector) => {
  document.body.append(modal);
  document.body.style.overflow = 'hidden';
  const release = trapFocus(modal);
  modal.querySelector(closeSelector).focus();
  return release;
};

// release must run before trigger.focus() — trapFocus marks every sibling
// inert, and focus() on an inert element is a silent no-op. Centralizing the
// order here (not just the individual calls) removes the chance of a future
// modal getting that order wrong.
export const closeModal = (modal, release, trigger) => {
  release?.();
  modal.remove();
  document.body.style.overflow = '';
  trigger?.focus();
};
