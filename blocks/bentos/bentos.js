const decorateCard = (card) => {
  card.classList.add('bento-card');

  const heading = card.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('bento-card-title');

  const paragraphs = [...card.querySelectorAll('p')];
  const ctaParas = paragraphs.filter((p) => p.querySelector('a'));
  const bodyParas = paragraphs.filter((p) => !p.querySelector('a'));

  bodyParas.forEach((p) => p.classList.add('bento-card-body'));

  if (ctaParas.length) {
    const ctaWrapper = document.createElement('div');
    ctaWrapper.classList.add('bento-card-cta');
    ctaParas[0].parentNode.insertBefore(ctaWrapper, ctaParas[0]);

    ctaParas.forEach((p) => {
      [...p.querySelectorAll('a')].forEach((a) => ctaWrapper.append(a));
      p.remove();
    });

    [...ctaWrapper.querySelectorAll('a')].forEach((a, idx) => {
      a.classList.add('btn', idx === 0 ? 'btn-primary' : 'btn-secondary');
    });
  }
};

export default (el) => {
  [...el.children].forEach((row) => {
    row.classList.add('bento-grid');
    const cards = [...row.children];
    row.style = `--card-count: ${cards.length}`;
    cards.forEach(decorateCard);
  });
};
