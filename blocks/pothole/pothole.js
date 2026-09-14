// Pothole: scroll-parallax background behind CTA content. `--progress`
// (from trackScrollProgress) drives translateY in CSS; reduced motion
// stays at the resting frame.
import { decoratePothole } from './decorate.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  if (!guardDecorate(el, 'pothole')) return;
  decoratePothole(el, { testidPrefix: 'pothole' });
};
