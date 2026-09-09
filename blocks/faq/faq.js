import { getConfig } from '../../scripts/ak.js';
import { inject } from '../../scripts/utils/seo/jsonld.js';

const { log } = getConfig();

const buildSchema = (items) => {
  const mainEntity = items.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  }));

  inject({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  });
};

export default (el) => {
  if (el.dataset.faq) return;
  el.dataset.faq = 'true';

  const rows = [...el.querySelectorAll(':scope > div')];
  const items = [];

  for (const row of rows) {
    const [qCol, aCol] = [...row.children];
    const question = qCol?.textContent.trim();

    if (qCol && aCol && question) {
      const answerText = aCol.textContent.trim();

      const details = document.createElement('details');
      details.className = 'faq-item';

      const summary = document.createElement('summary');
      summary.className = 'faq-question';
      summary.textContent = question;

      const content = document.createElement('div');
      content.className = 'faq-answer';
      // move authored nodes directly — no innerHTML round-trip (avoids re-parsing
      // authored markup as a string; keeps the decorator's XSS surface minimal)
      content.append(...aCol.childNodes);

      details.append(summary, content);

      el.append(details);
      items.push({ question, answer: answerText });
    } else {
      log('Skipping FAQ row with missing question or answer content.');
    }
  }

  for (const row of rows) row.remove();

  if (items.length) buildSchema(items);
};
