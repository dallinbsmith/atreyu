import { inject } from '../../scripts/utils/jsonld.js';

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
  const rows = [...el.querySelectorAll(':scope > div')];
  const items = [];

  for (const row of rows) {
    const [qCol, aCol] = [...row.children];
    if (qCol && aCol) {
      const question = qCol.textContent.trim();
      const answer = aCol.innerHTML.trim();

      const details = document.createElement('details');
      details.className = 'faq-item';

      const summary = document.createElement('summary');
      summary.className = 'faq-question';
      summary.textContent = question;

      const content = document.createElement('div');
      content.className = 'faq-answer';
      content.innerHTML = answer;

      details.append(summary, content);

      el.append(details);
      items.push({ question, answer: aCol.textContent.trim() });
    }
  }

  for (const row of rows) row.remove();

  if (items.length) buildSchema(items);
};
