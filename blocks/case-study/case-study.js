import { decorateRichText } from '../../scripts/utils/richtext.js';

// Authoring shape: two rows, classified by content shape, never by index —
// side rail = a row containing a stats <ul>, a PDF download link, or an
// image (intro heading, optional PDF link, logo image, stats list, intro
// paragraph, in any order); article = the other row (subheadings + paragraphs).
export default (el) => {
  if (el.dataset.caseStudy) return;
  el.dataset.caseStudy = 'true';

  const rows = [...el.querySelectorAll(':scope > div')];
  const sideRailRow = rows.find((r) => r.querySelector('ul, a[href$=".pdf"], img'));
  const articleRow = rows.find((r) => r !== sideRailRow);
  if (!sideRailRow || !articleRow) return;

  const sideRail = sideRailRow.querySelector(':scope > div') ?? sideRailRow;
  sideRail.classList.add('case-study-side-rail');

  const article = articleRow.querySelector(':scope > div') ?? articleRow;
  article.classList.add('case-study-article');

  sideRail.querySelector('a[href$=".pdf"]')?.classList.add('case-study-download');
  sideRail.querySelector('ul')?.classList.add('case-study-stats');

  el.replaceChildren(sideRail, article);
  decorateRichText(el);
};
