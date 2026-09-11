import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/pricing/pricing.js';
import { flush } from '../../scripts/utils/seo/jsonld.js';

// Build an EDS-shaped pricing table: each row is a div of cells. Features
// (`ul`) and CTA (`a`) are found by content shape; leftover cells in DOM
// order are the positional `name | price | description` triple.
const cell = (html) => {
  const c = document.createElement('div');
  c.innerHTML = html;
  return c;
};

const planRow = ({
  name, price, description, features, cta,
}) => {
  const row = document.createElement('div');
  row.append(cell(name), cell(price), cell(description), cell(features), cell(cta));
  return row;
};

const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'pricing';
  rows.forEach((r) => el.append(r));
  document.body.append(el);
  return el;
};

const normalPlan = {
  name: 'Basic',
  price: '$9/mo',
  description: 'For individuals',
  features: '<ul><li>Feature A</li><li>Feature B</li></ul>',
  cta: '<a href="/signup-basic">Sign up</a>',
};

const highlightedPlan = {
  name: '<strong>Pro</strong>',
  price: '$29/mo',
  description: 'For teams',
  features: '<ul><li>Feature C</li><li>Feature D</li></ul>',
  cta: '<a class="btn btn-primary" href="/signup-pro">Sign up</a>',
};

const readSchema = () => {
  const script = document.head.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent) : null;
};

describe('pricing', () => {
  it('builds correct name/price/description/features/CTA for a normal and a highlighted plan', async () => {
    const el = block([planRow(normalPlan), planRow(highlightedPlan)]);
    await decorate(el);

    const cards = el.querySelectorAll('.pricing-plan');
    expect(cards).to.have.length(2);

    const [basic, pro] = cards;
    expect(basic.classList.contains('highlighted')).to.be.false;
    expect(basic.querySelector('.pricing-name').textContent).to.equal('Basic');
    expect(basic.querySelector('.pricing-price').textContent).to.equal('$9/mo');
    expect(basic.querySelector('.pricing-description').textContent).to.equal('For individuals');
    expect(basic.querySelectorAll('.pricing-features li')).to.have.length(2);
    expect(basic.querySelector('.pricing-cta').getAttribute('href')).to.equal('/signup-basic');

    expect(pro.classList.contains('highlighted')).to.be.true;
    expect(pro.querySelector('.pricing-badge')).to.exist;
    expect(pro.querySelector('.pricing-name').textContent).to.equal('Pro');
    expect(pro.querySelector('.pricing-price').textContent).to.equal('$29/mo');
    expect(pro.querySelectorAll('.pricing-features li')).to.have.length(2);
    expect(pro.querySelector('.pricing-cta').getAttribute('href')).to.equal('/signup-pro');
  });

  it('double-decorate does not corrupt content (Fix 1 regression)', async () => {
    const el = block([planRow(normalPlan), planRow(highlightedPlan)]);
    await decorate(el);
    await decorate(el);

    const cards = el.querySelectorAll('.pricing-plan');
    expect(cards).to.have.length(2);

    const [basic, pro] = cards;
    expect(basic.querySelector('.pricing-name').textContent).to.equal('Basic');
    expect(basic.querySelector('.pricing-price').textContent).to.equal('$9/mo');
    expect(basic.querySelector('.pricing-description').textContent).to.equal('For individuals');
    expect(basic.querySelectorAll('.pricing-features li')).to.have.length(2);
    expect(basic.querySelector('.pricing-cta')).to.exist;
    expect(basic.querySelector('.pricing-cta').getAttribute('href')).to.equal('/signup-basic');

    expect(pro.querySelector('.pricing-name').textContent).to.equal('Pro');
    expect(pro.querySelector('.pricing-price').textContent).to.equal('$29/mo');
    expect(pro.querySelector('.pricing-description').textContent).to.equal('For teams');
    expect(pro.querySelectorAll('.pricing-features li')).to.have.length(2);
    expect(pro.querySelector('.pricing-cta')).to.exist;
    expect(pro.querySelector('.pricing-cta').getAttribute('href')).to.equal('/signup-pro');
  });

  it('CTA anchor retains a pre-existing .btn/.btn-primary class alongside .pricing-cta (Fix 2 regression)', async () => {
    const el = block([planRow(highlightedPlan)]);
    await decorate(el);

    const cta = el.querySelector('.pricing-cta');
    expect(cta.classList.contains('btn')).to.be.true;
    expect(cta.classList.contains('btn-primary')).to.be.true;
    expect(cta.classList.contains('pricing-cta')).to.be.true;
  });

  it('a plan priced "Custom Pricing" is excluded from JSON-LD, not given a false "0" price (Fix 3 regression)', async () => {
    const customPlan = { ...normalPlan, name: 'Enterprise', price: 'Custom Pricing' };
    const el = block([planRow(normalPlan), planRow(customPlan)]);
    await decorate(el);
    flush();

    const payload = readSchema();
    const product = payload['@graph'].findLast((entry) => entry['@type'] === 'Product');
    expect(product.offers.some((o) => o.name === 'Enterprise')).to.be.false;
    expect(product.offers.some((o) => o.name === 'Basic')).to.be.true;
  });

  it('injects valid JSON-LD offers for a normal set of numeric-priced plans', async () => {
    const el = block([planRow(normalPlan), planRow(highlightedPlan)]);
    await decorate(el);
    flush();

    const payload = readSchema();
    expect(payload['@context']).to.equal('https://schema.org');
    const product = payload['@graph'].findLast((entry) => entry['@type'] === 'Product');
    expect(product.name).to.equal('Frame.io');

    const basicOffer = product.offers.find((o) => o.name === 'Basic');
    expect(basicOffer['@type']).to.equal('Offer');
    expect(basicOffer.price).to.equal('9');
    expect(basicOffer.priceCurrency).to.equal('USD');
    expect(basicOffer.description).to.equal('For individuals');

    const proOffer = product.offers.find((o) => o.name === 'Pro');
    expect(proOffer.price).to.equal('29');
  });
});
