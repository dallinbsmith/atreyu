export default (el) => {
  const inner = el.querySelector(':scope > div > div');
  if (!inner) return;
  inner.classList.add('bookend-content');

  const heading = inner.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('bookend-heading');

  const paragraphs = [...inner.querySelectorAll('p')];
  for (const p of paragraphs) {
    if (!p.querySelector('a')) {
      p.classList.add('bookend-body');
    }
  }

  const ctaPara = [...inner.querySelectorAll('p')]
    .reverse()
    .find((p) => p.querySelector('a'));
  if (ctaPara) {
    ctaPara.classList.add('bookend-cta');
    const links = ctaPara.querySelectorAll('a');
    for (const [idx, a] of [...links].entries()) {
      a.classList.add('btn');
      a.classList.add(idx === 0 ? 'btn-primary' : 'btn-secondary');
    }
  }
};
