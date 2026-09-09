export default (el) => {
  const inner = el.querySelector(':scope > div');
  if (!inner) return;
  inner.classList.add('card-inner');
  const pic = el.querySelector('picture');
  const picPara = pic?.closest('p');
  if (picPara) {
    const picDiv = document.createElement('div');
    picDiv.className = 'card-picture-container';
    picDiv.append(pic);
    inner.prepend(picDiv);
    picPara.remove();
  }

  // Classify by content shape, not position/class-absence: the real content
  // cell is whichever direct-child div actually has text — this also skips
  // an emptied media cell left behind above (its wrapping <p> was removed,
  // but the cell div itself is not), instead of misclassifying it as content.
  const con = [...inner.children].find((c) => c.tagName === 'DIV' && c.textContent.trim());
  if (!con) return;
  con.classList.add('card-content-container');

  // Find the CTA by content shape (a paragraph containing a link) rather than
  // by position (last div's last paragraph) — an authored CTA para isn't
  // always the literal last node in the content cell.
  const ctaPara = [...con.querySelectorAll('p')].findLast((p) => p.querySelector('a'));
  if (!ctaPara) return;
  const cta = ctaPara.querySelector('a');
  if (el.classList.contains('hash-aware') && window.location.hash) {
    const url = new URL(cta.href, window.location.origin);
    url.hash = window.location.hash;
    cta.href = url.href;
  }
  ctaPara.classList.add('card-cta-container');
  inner.append(ctaPara);
};
