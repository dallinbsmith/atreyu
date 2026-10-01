import { expect } from '@esm-bundle/chai';

// jsonld.js keeps a module-level `graph` + a <head> script singleton, so each
// test imports a fresh copy (cache-busted specifier = distinct module instance),
// same isolation approach as other cache-busted module tests.
let importCounter = 0;
const freshJsonld = () => {
  importCounter += 1;
  return import(`../../../scripts/utils/seo/jsonld.js?t=${importCounter}`);
};

const latestScript = () => [...document.head.querySelectorAll('script[type="application/ld+json"]')].at(-1);

const readGraph = () => {
  const unescaped = latestScript().textContent
    .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&');
  return JSON.parse(unescaped)['@graph'];
};

describe('scripts/utils/seo/jsonld.js inject', () => {
  afterEach(() => {
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
  });

  it('appends every injected node in call order (no dedup)', async () => {
    const { inject, flush } = await freshJsonld();
    inject({ '@type': 'Product', '@id': '#a', name: 'A' });
    inject({ '@type': 'Product', '@id': '#b', name: 'B' });
    flush();
    expect(readGraph().filter((n) => n['@type'] === 'Product').map((n) => n.name))
      .to.deep.equal(['A', 'B']);
  });

  it('escapes </script> so authored text cannot break out of the <head> script', async () => {
    const { inject, flush } = await freshJsonld();
    inject({ '@type': 'FAQPage', name: 'x </script><img> & y' });
    flush();
    const { textContent } = latestScript();
    expect(textContent).to.not.include('</script>');
    expect(textContent).to.not.include('<img>');
    expect(textContent).to.include('\\u003c');
  });
});
