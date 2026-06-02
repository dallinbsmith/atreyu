// Feature navigation grid. Each authored row is [media, label, link]; the whole
// card becomes the link target. Used to cross-link sibling feature pages.
export default (el) => {
  [...el.children].forEach((row) => {
    const link = row.querySelector('a');
    const media = row.querySelector('picture, img, video');
    const label = [...row.querySelectorAll('h1, h2, h3, h4, h5, h6, p')]
      .map((n) => n.textContent.trim())
      .find((t) => t && !t.startsWith('http')) || link?.textContent.trim() || '';

    const card = document.createElement(link ? 'a' : 'div');
    card.className = 'cgn-card';
    if (link) {
      card.href = link.getAttribute('href');
      if (link.target) card.target = link.target;
      if (link.rel) card.rel = link.rel;
    }
    if (media) {
      const wrap = document.createElement('div');
      wrap.className = 'cgn-media';
      wrap.append(media);
      card.append(wrap);
    }
    const cap = document.createElement('span');
    cap.className = 'cgn-label';
    cap.textContent = label;
    card.append(cap);
    row.replaceWith(card);
  });
};
