import { decorateRichText } from '../../scripts/utils/richtext.js';

// Behavioral marks (/widgets/{name} links) are handled centrally by the
// scripts/behaviors.js registry: ak.js tags them, the phase runners init them.

export default (el) => {
  const content = el.querySelector(':scope > div > div') ?? el;
  content.classList.add('rich-text-content');
  decorateRichText(content);
};
