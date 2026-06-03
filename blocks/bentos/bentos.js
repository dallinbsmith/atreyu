import { decorateTout } from '../../scripts/utils/touts.js';

export default (el) => {
  [...el.children].forEach((row) => {
    row.classList.add('bento-grid');
    const cards = [...row.children];
    row.style = `--card-count: ${cards.length}`;
    cards.forEach((card) => {
      // Lift an authored screenshot/icon out as card media (above the title)
      // before tout decoration so it isn't treated as body content.
      const pic = card.querySelector('picture, img');
      let media;
      if (pic) {
        const host = pic.closest('p') ?? pic;
        media = document.createElement('div');
        media.className = 'bento-card-media';
        media.append(pic.closest('picture') ?? pic);
        if (host !== card && host.parentElement === card && !host.textContent.trim()) host.remove();
      }
      decorateTout(card, 'bento-card');
      if (media) card.prepend(media);
    });
  });
};
