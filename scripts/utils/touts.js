// Shared tout/card decoration: heading → title, body paragraphs → body,
// CTA links lifted into a single cta wrapper (first = primary, rest = secondary).
// Reused by the bentos and side-by-side blocks. Class prefix is configurable so
// each block keeps its own BEM-ish namespace while sharing the logic.
export const decorateTout = (el, prefix = 'tout') => {
  el.classList.add(prefix);

  // Author-driven icon: an authored `:icon:` (span.icon) is hoisted above the
  // title and classed for styling. No icon → unchanged (backward compatible).
  const icon = el.querySelector('.icon');
  if (icon) {
    icon.classList.add(`${prefix}-icon`);
    const wrap = icon.closest('p');
    el.prepend(icon);
    if (wrap && wrap !== el && !wrap.textContent.trim() && !wrap.querySelector('a, img')) wrap.remove();
  }

  const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add(`${prefix}-title`);

  const paragraphs = [...el.querySelectorAll('p')];
  const ctaParas = paragraphs.filter((p) => p.querySelector('a'));
  const bodyParas = paragraphs.filter((p) => !p.querySelector('a'));

  bodyParas.forEach((p) => p.classList.add(`${prefix}-body`));

  if (!ctaParas.length) return;

  const ctaWrapper = document.createElement('div');
  ctaWrapper.classList.add(`${prefix}-cta`);
  ctaParas[0].parentNode.insertBefore(ctaWrapper, ctaParas[0]);

  ctaParas.forEach((p) => {
    [...p.querySelectorAll('a')].forEach((a) => ctaWrapper.append(a));
    p.remove();
  });

  // Defer to the framework: links already buttonized by decorateButton (from
  // authored em/strong/underline) keep that author-intended variant. Only assign
  // positional primary/secondary to plain links not yet classed.
  [...ctaWrapper.querySelectorAll('a')].forEach((a, idx) => {
    if (a.classList.contains('btn')) return;
    a.classList.add('btn', idx === 0 ? 'btn-primary' : 'btn-secondary');
  });
};
