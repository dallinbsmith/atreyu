export default (el) => {
  const inner = el.querySelector(':scope > div');
  inner.classList.add('card-inner');
  const pic = el.querySelector('picture');
  const picPara = pic?.closest('p');
  if (picPara) {
    const picDiv = document.createElement('div');
    picDiv.className = 'card-picture-container';
    picDiv.append(pic);
    inner.insertAdjacentElement('afterbegin', picDiv);
    picPara.remove();
  }

  const con = inner.querySelector(':scope > div:not([class])');
  if (!con) return;
  con.classList.add('card-content-container');

  const cta = inner.querySelector(':scope > div:last-of-type > p:last-of-type a');
  if (!cta) return;
  if (el.classList.contains('hash-aware') && window.location.hash) {
    const url = new URL(cta.href, window.location.origin);
    url.hash = window.location.hash;
    cta.href = url.href;
  }
  const ctaPara = cta.closest('p');
  ctaPara.classList.add('card-cta-container');
  inner.append(ctaPara);
};
