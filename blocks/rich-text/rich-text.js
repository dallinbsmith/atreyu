import { decorateRichText } from '../../scripts/utils/richtext.js';
import { classifyCtaParagraphs, getCells } from '../../scripts/utils/dom.js';

// Behavioral marks (/widgets/{name} links) are handled centrally by the
// scripts/behaviors.js registry: ak.js tags them, the phase runners init them.

export default (el) => {
  const [content = el, ...others] = getCells(el);
  for (const cell of others) content.append(...cell.childNodes);
  content.classList.add('rich-text-content');
  decorateRichText(content);
  classifyCtaParagraphs(content, 'rt-cta-para');
};
