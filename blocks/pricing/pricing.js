import { getMetadata } from '../../scripts/ak.js';
import { createElement } from '../../scripts/utils/dom.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { inject } from '../../scripts/utils/seo/jsonld.js';

const numericPrice = (price) => {
  const n = price.replace(/[^0-9.]/g, '');
  return n !== '' && Number.isFinite(Number(n)) ? n : null;
};

const injectSchema = (plans) => {
  const offers = plans.flatMap(({ name, price, description }) => {
    const value = numericPrice(price);
    return value ? [{
      '@type': 'Offer', name, description, price: value, priceCurrency: 'USD',
    }] : [];
  });
  if (!offers.length) return;
  inject({
    '@type': 'Product',
    name: 'Frame.io',
    description: getMetadata('description') || 'Video collaboration and review platform by Adobe.',
    offers,
  });
};

const para = (className, text) => (text ? createElement('p', { className }, text) : null);

// Features (`ul`) and CTA (`a`) by content shape; leftover cells in DOM
// order are the positional `name | price | description` triple.
const buildCard = (row, badgeText) => {
  const list = row.querySelector('ul');
  const cta = row.querySelector('a');
  const [nameCol, priceCol, descCol] = [...row.children].filter(
    (c) => !c.contains(list) && !c.contains(cta),
  );
  if (!nameCol) return null;

  const [name, price, description] = [nameCol, priceCol, descCol]
    .map((el) => el?.textContent.trim() ?? '');
  const highlighted = !!nameCol.querySelector('strong');
  list?.classList.add('pricing-features');
  cta?.classList.add('pricing-cta');

  return {
    name,
    price,
    description,
    card: createElement(
      'div',
      {
        className: `pricing-plan${highlighted ? ' highlighted' : ''}`,
      },
      highlighted && createElement('span', { className: 'pricing-badge' }, badgeText),
      createElement('h3', { className: 'pricing-name' }, name),
      para('pricing-price', price),
      para('pricing-description', description),
      list,
      cta,
    ),
  };
};

export default async (el) => {
  if (el.dataset.pricing) return;
  el.dataset.pricing = 'true';
  const badgeText = await getPlaceholder('pricingMostPopular', 'Most Popular');
  const plans = [...el.children].map((row) => buildCard(row, badgeText)).filter(Boolean);
  el.replaceChildren(...plans.map(({ card }) => card));
  if (plans.length) injectSchema(plans);
};
