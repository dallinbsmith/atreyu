import { expect } from '@esm-bundle/chai';
import injectCanonical from '../../../scripts/utils/seo/canonical.js';

describe('canonical', () => {
  afterEach(() => {
    document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
  });

  it('injects a self-referencing canonical link', () => {
    window.history.pushState({}, '', '/de-de/features/c2c');
    injectCanonical();

    const link = document.head.querySelector('link[rel="canonical"]');
    expect(link).to.exist;
    expect(link.href).to.equal(`${window.location.origin}/de-de/features/c2c`);
  });

  it('excludes query params and hash from the canonical URL', () => {
    window.history.pushState({}, '', '/pricing?utm_source=test&gclid=abc123#plans');
    injectCanonical();

    const link = document.head.querySelector('link[rel="canonical"]');
    expect(link.href).to.equal(`${window.location.origin}/pricing`);
  });
});
