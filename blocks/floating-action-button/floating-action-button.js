// Floating action button: a position: fixed pill (authored label + a
// decorative play triangle) that opens the authored Wistia video in the
// shared video modal. Falkor's real version adds GSAP Flip morph-to-modal,
// mouse-distance magnetism, scroll-driven show/hide and scroll-lock — none of
// that is ported. This is the honest EDS reduction: a <button> that calls
// openVideoModal, letting the shared util own the dialog, focus trap, Escape,
// backdrop, a11y announce, and focus-restore-to-trigger on close. Motion is a
// subtle appear-on-load only, gated on shouldAnimate() — deliberately NOT
// scroll-driven, so there are no window/document listeners to leak, and the
// resting DOM is a fully present, usable button when motion is off.
import { openVideoModal, WISTIA_RE } from '../../scripts/utils/modal/video-modal.js';
import { createElement, getCells } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';

export default (el) => {
  if (!guardDecorate(el, 'floatingActionButton')) return;

  const cells = getCells(el);
  const link = [...el.querySelectorAll('a')].find((a) => WISTIA_RE.test(a.href));
  // Fail safe: no Wistia link means there's no video to open — render nothing
  // rather than ship a dead, actionless button.
  if (!link) {
    el.replaceChildren();
    return;
  }

  // Label = the authored label string (a text cell that isn't the link cell);
  // fall back to the link's own text. An unnamed control is worse than none,
  // so with no usable label at all, fail safe rather than ship a button with
  // no accessible name.
  const labelCell = cells.find((c) => c.textContent.trim() && !c.querySelector('a'));
  const label = (labelCell?.textContent ?? link.textContent).trim();
  if (!label) {
    el.replaceChildren();
    return;
  }

  const [, wistiaId] = link.href.match(WISTIA_RE);

  // The visible label text IS the accessible name; the play triangle is
  // decorative (aria-hidden) since the label already names the action.
  const button = createElement(
    'button',
    { type: 'button', className: 'fab-button' },
    createElement('span', { className: 'fab-label' }, label),
    createElement('span', { className: 'fab-icon', 'aria-hidden': 'true' }),
  );
  button.addEventListener('click', () => openVideoModal(wistiaId, label, button));

  el.replaceChildren(button);

  // Subtle appear-on-load, double-gated (shouldAnimate() here + a
  // prefers-reduced-motion media guard in CSS). Without this class the button
  // is the fully-visible, usable resting state.
  if (shouldAnimate()) el.classList.add('fab-animate');
};
