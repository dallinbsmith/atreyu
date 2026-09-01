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
