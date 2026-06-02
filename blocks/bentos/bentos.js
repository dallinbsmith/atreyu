import { decorateTout } from '../../scripts/utils/touts.js';

export default (el) => {
  [...el.children].forEach((row) => {
    row.classList.add('bento-grid');
    const cards = [...row.children];
    row.style = `--card-count: ${cards.length}`;
    cards.forEach((card) => decorateTout(card, 'bento-card'));
  });
};
