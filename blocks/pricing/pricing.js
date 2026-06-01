import { inject } from '../../scripts/utils/jsonld.js';

const buildCard = (row) => {
  const cols = [...row.children];
  const [nameCol, priceCol, descCol, featuresCol, ctaCol] = cols;
  if (!nameCol) return null;

  const name = nameCol.textContent.trim();
  const isHighlighted = !!nameCol.querySelector('strong');
  const price = priceCol?.textContent.trim() ?? '';
  const description = descCol?.textContent.trim() ?? '';

  const card = document.createElement('div');
  card.className = `pricing-plan${isHighlighted ? ' highlighted' : ''}`;

  if (isHighlighted) {
    const badge = document.createElement('span');
    badge.className = 'pricing-badge';
    badge.textContent = 'Most Popular';
    card.append(badge);
  }

  const heading = document.createElement('h3');
  heading.className = 'pricing-name';
  heading.textContent = name;
  card.append(heading);

  if (price) {
    const priceEl = document.createElement('p');
    priceEl.className = 'pricing-price';
    priceEl.textContent = price;
    card.append(priceEl);
  }

  if (description) {
    const desc = document.createElement('p');
    desc.className = 'pricing-description';
    desc.textContent = description;
    card.append(desc);
  }

  if (featuresCol) {
    const list = featuresCol.querySelector('ul');
    if (list) {
      list.className = 'pricing-features';
      card.append(list);
    }
  }

  const cta = ctaCol?.querySelector('a');
  if (cta) {
    cta.className = 'pricing-cta';
    card.append(cta);
  }

  return { card, name, price, description };
};

const injectSchema = (plans) => {
  const offers = plans
    .filter(({ price }) => price && price !== 'Custom')
    .map(({ name, price, description }) => ({
      '@type': 'Offer',
      name,
      description,
      price: price.replace(/[^0-9.]/g, '') || '0',
      priceCurrency: 'USD',
    }));

  if (!offers.length) return;

  inject({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Frame.io',
    description: 'Video collaboration and review platform by Adobe.',
    offers,
  });
};

export default (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  const plans = [];

  for (const row of rows) {
    const result = buildCard(row);
    if (result) {
      el.append(result.card);
      plans.push(result);
    }
  }

  for (const row of rows) row.remove();
  if (plans.length) injectSchema(plans);
};
