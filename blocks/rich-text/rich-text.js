import { decorateRichText } from '../../scripts/utils/richtext.js';

// Behavioral marks (/widgets/{name} links) are handled centrally by the
// scripts/behaviors.js registry: ak.js tags them, the phase runners init them.

export default (el) => {
  const cells = [...el.querySelectorAll(':scope > div > div')];
  const content = cells[0] ?? el;
  cells.slice(1).forEach((cell) => content.append(...cell.childNodes));
  content.classList.add('rich-text-content');
  decorateRichText(content);
};
