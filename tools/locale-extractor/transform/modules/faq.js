// module.faq → the `faq` block (site/blocks/faq). Real shape confirmed on
// the ja-jp pricing page: `sections[]`, each `{ question, answer: { content
// } }` (question is a plain string, answer is Portable Text), plus a `text`
// field holding the section's own heading ("よくある質問"). Real pages keep
// that heading as a SEPARATE sibling rich-text element in front of the faq
// block, not inside it (confirmed against the real, pre-existing
// ja-jp/features/c2c page), so this emits both: a plain heading wrapper,
// then the faq block itself. faq.js's own decorate() reads direct-child
// rows of the block as [questionCell, answerCell] pairs.
import { renderPortableText } from '../portable-text.js';
import { row, cell, block } from '../dom-helpers.js';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const transformFaq = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const heading = module.text?.content
    ? `<div>${renderPortableText(module.text.content, warnings, resolvedRefs).join('')}</div>`
    : '';
  const rows = (module.sections ?? []).map((section) => {
    const question = `<p>${escapeHtml(section.question ?? '')}</p>`;
    const answer = renderPortableText(section.answer?.content, warnings, resolvedRefs);
    return row(cell(question), cell(...answer));
  });
  return heading + block('faq', ...rows);
};
