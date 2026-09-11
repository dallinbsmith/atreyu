import { HEADING_SELECTOR } from '../../scripts/utils/dom.js';

export default (el) => {
  const inner = el.querySelector(':scope > div > div');
  if (!inner) return;
  inner.classList.add('bookend-content');

  const heading = inner.querySelector(HEADING_SELECTOR);
  if (heading) heading.classList.add('bookend-heading');

  const paragraphs = [...inner.querySelectorAll('p')];
  const ctaParas = paragraphs.filter((p) => p.querySelector('a'));
  const bodyParas = paragraphs.filter((p) => !p.querySelector('a'));

  bodyParas.forEach((p) => p.classList.add('bookend-body'));

  if (!ctaParas.length) return;

  // Merge every link-bearing paragraph into one CTA container — an author
  // authoring two separate CTA paragraphs must not have the earlier one
  // silently lose its .btn styling (see scripts/utils/touts.js decorateTout
  // for the same merge pattern used elsewhere).
  const ctaWrapper = document.createElement('div');
  ctaWrapper.classList.add('bookend-cta');
  ctaParas[0].parentNode.insertBefore(ctaWrapper, ctaParas[0]);

  ctaParas.forEach((p) => {
    [...p.querySelectorAll('a')].forEach((a) => ctaWrapper.append(a));
    p.remove();
  });

  [...ctaWrapper.querySelectorAll('a')].forEach((a, idx) => {
    if (!a.classList.contains('btn')) a.classList.add('btn', idx === 0 ? 'btn-primary' : 'btn-secondary');
  });
};
