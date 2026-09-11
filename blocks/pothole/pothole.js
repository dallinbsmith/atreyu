// Pothole: scroll-parallax background behind CTA content. `--progress`
// (from trackScrollProgress) drives translateY in CSS; reduced motion
// stays at the resting frame.
import { decoratePothole } from '../../scripts/utils/pothole.js';

export default (el) => {
  if (el.dataset.pothole) return;
  el.dataset.pothole = 'true';
  decoratePothole(el, { testidPrefix: 'pothole' });
};
