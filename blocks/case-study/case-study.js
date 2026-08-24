import { decorateRichText } from '../../scripts/utils/richtext.js';

// Authoring shape: two rows — row 0 is the side rail (intro heading, optional
// PDF download link, logo image, stats list, intro paragraph, in any order),
// row 1 is the main article body (subheadings + paragraphs).
export default (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  const [sideRailRow, articleRow] = rows;
  if (!sideRailRow || !articleRow) return;

  const sideRail = sideRailRow.querySelector(':scope > div');
  sideRail.classList.add('case-study-side-rail');

  const article = articleRow.querySelector(':scope > div');
  article.classList.add('case-study-article');

  sideRail.querySelector('a[href$=".pdf"]')?.classList.add('case-study-download');
  sideRail.querySelector('ul')?.classList.add('case-study-stats');

  el.replaceChildren(sideRail, article);
  decorateRichText(el);
};
