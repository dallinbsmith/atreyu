import { expect } from '@esm-bundle/chai';
import { setConsent, resetConsent } from '../../../scripts/utils/analytics/consent.js';

// pzn.js reads window.location.search and caches its own config, decision
// promise, and variants promise at module scope — a real design constraint,
// not something this test suite works around by changing production code.
// history.replaceState changes the URL without a real navigation/reload;
// combined with a cache-busting query string on the *import specifier*
// (browsers treat distinct module URLs as distinct module instances), each
// test gets a genuinely fresh copy of that module-level state.
let importCounter = 0;
const freshPzn = async (search = '') => {
  history.replaceState(null, '', `${window.location.pathname}${search}`);
  importCounter += 1;
  return import(`../../../scripts/utils/analytics/pzn.js?t=${importCounter}`);
};

const FIXTURE_URL = '/system/personalization/variants.json';
const DECISION_URL = '/api/decision';
const COOKIE_NAME = 'frameio-pzn-segment';

const setupSection = () => {
  document.body.innerHTML = `
    <section data-pzn="hero-cta">
      <a class="cta-link" href="/default">Default CTA</a>
    </section>
  `;
  return document.querySelector('section');
};

const variantRow = (overrides = {}) => ({
  placement: 'hero-cta',
  segment: 'enterprise',
  type: 'cta',
  selector: '.cta-link',
  fragment: '',
  label: 'Enterprise CTA',
  href: '/enterprise',
  weight: '100',
  commit_until: '',
  ...overrides,
});

const mockFetch = (routes) => {
  window.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    const match = routes.find(([pattern]) => url.includes(pattern));
    if (!match) return { ok: false, status: 404 };
    const [, respond] = match;
    return respond(url);
  };
};

const variantsResponse = (rows) => ({
  ok: true,
  json: async () => ({ total: rows.length, offset: 0, limit: rows.length, data: rows }),
});

describe('scripts/utils/analytics/pzn.js', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    resetConsent();
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  describe('preview mode (?segment=)', () => {
    it('applies the matching variant with no cookie and no decision call', async () => {
      const section = setupSection();
      let decisionCalled = false;
      mockFetch([
        [DECISION_URL, () => { decisionCalled = true; return { ok: true, json: async () => ({ segment: 'enterprise' }) }; }],
        [FIXTURE_URL, () => variantsResponse([variantRow()])],
      ]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
      expect(document.cookie).to.not.include(COOKIE_NAME);
      expect(decisionCalled).to.be.false;
    });

    it('leaves baseline content when no row matches the previewed segment', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);

      const { decoratePznSlots } = await freshPzn('?segment=nonexistent-segment');
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
    });
  });

  describe('warm visit (cookie already set)', () => {
    it('applies synchronously with no decision call', async () => {
      const section = setupSection();
      document.cookie = `${COOKIE_NAME}=enterprise; path=/`;
      let decisionCalled = false;
      mockFetch([
        [DECISION_URL, () => { decisionCalled = true; return { ok: true, json: async () => ({ segment: 'enterprise' }) }; }],
        [FIXTURE_URL, () => variantsResponse([variantRow()])],
      ]);

      const { decoratePznSlots } = await freshPzn();
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
      expect(decisionCalled).to.be.false;
    });
  });

  describe('cold visit (decision endpoint)', () => {
    it('applies the resolved variant and sets the segment cookie, only when consent is granted', async () => {
      const section = setupSection();
      setConsent({ personalization: true, analytics: true, marketing: true });
      mockFetch([
        [DECISION_URL, () => ({ ok: true, json: async () => ({ segment: 'enterprise' }) })],
        [FIXTURE_URL, () => variantsResponse([variantRow()])],
      ]);

      const { decoratePznSlots } = await freshPzn();
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 400); }); // real fade + fetch round trip

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
      expect(document.cookie).to.include(`${COOKIE_NAME}=enterprise`);
    });

    it('never calls the decision endpoint without personalization consent — real bug-squash fix (A2a analogue for pzn.js)', async () => {
      setupSection();
      let decisionCalled = false;
      mockFetch([
        [DECISION_URL, () => { decisionCalled = true; return { ok: true, json: async () => ({ segment: 'enterprise' }) }; }],
        [FIXTURE_URL, () => variantsResponse([variantRow()])],
      ]);

      const { decoratePznSlots } = await freshPzn();
      decoratePznSlots(document); // consent never granted in this test
      await new Promise((r) => { setTimeout(r, 100); });

      expect(decisionCalled).to.be.false;
    });

    it('fails open to baseline on a decision-endpoint error, without throwing', async () => {
      const section = setupSection();
      setConsent({ personalization: true, analytics: true, marketing: true });
      mockFetch([
        [DECISION_URL, () => ({ ok: false, status: 500 })],
        [FIXTURE_URL, () => variantsResponse([variantRow()])],
      ]);

      const { decoratePznSlots } = await freshPzn();
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
      expect(document.cookie).to.not.include(COOKIE_NAME);
    });
  });

  describe('row validation and fail-open (isValidRow)', () => {
    it('drops a malformed row but keeps its valid siblings', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([
        variantRow({ weight: 'not-a-number' }), // malformed — dropped
        variantRow({ segment: 'default', label: 'Default Variant', href: '/d' }),
      ])]]);

      const { decoratePznSlots } = await freshPzn('?segment=default');
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Default Variant');
    });

    it('excludes a row past its commit_until date — bug-squash fix, 2026-08-28', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([
        variantRow({ commit_until: '2020-01-01' }), // expired
      ])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
    });

    it('keeps a row with a blank commit_until (permanent, no expiry)', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ commit_until: '' })])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
    });

    it('does not throw on a corrupted sessionStorage cache — bug-squash fix, 2026-08-28', async () => {
      sessionStorage.setItem('pzn-variants-cache-v1', '{not valid json');
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      expect(() => decoratePznSlots(document)).to.not.throw();
      await new Promise((r) => { setTimeout(r, 50); });

      // loadVariants()'s outer try/catch treats a JSON.parse failure the same
      // as "no variants sheet at all" — fails open to [] rather than falling
      // through to a real refetch, so baseline content stays untouched.
      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
    });

    it('does not raise an unhandled rejection on a syntactically invalid authored selector — bug-squash fix', async () => {
      const section = setupSection();
      // isValidRow only checks selector truthiness, not CSS syntax — this
      // malformed value passes that filter and reaches querySelector() itself.
      // decorateSection() is async and deliberately fire-and-forget (never
      // awaited by its caller), so a caught-vs-uncaught throw here shows up
      // as an unhandled promise rejection, not a synchronous throw — a plain
      // `to.not.throw()` assertion wouldn't actually exercise this bug.
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ selector: '[' })])]]);
      let rejection = null;
      const onRejection = (e) => { rejection = e.reason; };
      window.addEventListener('unhandledrejection', onRejection);

      try {
        const { decoratePznSlots } = await freshPzn('?segment=enterprise');
        decoratePznSlots(document);
        await new Promise((r) => { setTimeout(r, 50); });
      } finally {
        window.removeEventListener('unhandledrejection', onRejection);
      }

      expect(rejection).to.equal(null);
      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
    });
  });

  describe('weighted split (weightedPick)', () => {
    it('sticky-splits distinct visitors across both variants of a real 50/50 row pair', async () => {
      mockFetch([[FIXTURE_URL, () => variantsResponse([
        variantRow({ segment: 'default', label: 'Variant A', href: '/a', weight: '50' }),
        variantRow({ segment: 'default', label: 'Variant B', href: '/b', weight: '50' }),
      ])]]);

      const seen = new Set();
      for (let i = 0; i < 12; i += 1) {
        localStorage.clear();
        // eslint-disable-next-line no-await-in-loop -- each iteration needs
        // its own fresh visitor id + fresh module instance, sequentially.
        const { decoratePznSlots } = await freshPzn('?segment=default');
        setupSection();
        decoratePznSlots(document);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => { setTimeout(r, 30); });
        seen.add(document.querySelector('.cta-link').textContent);
      }

      // With 12 distinct visitor ids against a real 50/50 split, both
      // variants should appear at least once — not asserting an exact ratio
      // (that's a statistical claim this suite shouldn't flake on), just
      // that the split is real, not a constant.
      expect(seen.size).to.equal(2);
    });
  });

  describe('same-origin validation (sameOriginOverride)', () => {
    it('rejects an absolute-URL pznEndpoint override and falls back to the default — bug-squash fix, 2026-08-28', async () => {
      setupSection();
      setConsent({ personalization: true, analytics: true, marketing: true });
      let calledUrl = null;
      window.fetch = async (input) => {
        calledUrl = typeof input === 'string' ? input : input.url ?? String(input);
        if (calledUrl.includes(FIXTURE_URL)) return variantsResponse([variantRow()]);
        return { ok: true, json: async () => ({ segment: 'enterprise' }) };
      };

      const { decoratePznSlots } = await freshPzn('?pznEndpoint=https://evil.example/steal');
      decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); });

      expect(calledUrl).to.not.include('evil.example');
    });
  });
});
