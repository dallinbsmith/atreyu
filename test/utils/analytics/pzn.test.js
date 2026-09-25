import { expect } from '@esm-bundle/chai';
import { setConsent, resetConsent } from '../../../scripts/utils/analytics/consent.js';
import { setAnalyticsProvider } from '../../../scripts/utils/analytics/analytics.js';

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
  let tracked;
  // 2026-09-22: decoratePznSlots() registers a `document`-level consent
  // listener that's normally only ever cleaned up if a personalization
  // consent-granted event fires after it's attached — fine for a real page
  // (called once per load), but this suite reimports pzn.js fresh per test
  // while sharing one real `document`, so a listener a test doesn't trigger
  // itself stays attached and can react to a LATER test's setConsent() call,
  // re-running that OLD test's own (now-detached) decorateSection and
  // writing into whatever `tracked` array happens to be current at that
  // moment. Capturing and stopping it here — not a pzn.js bug, since no real
  // page ever re-runs decoratePznSlots() the way this suite deliberately
  // does for isolation.
  let stopPzn;

  beforeEach(() => {
    originalFetch = window.fetch;
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    resetConsent();
    tracked = [];
    stopPzn = null;
    setAnalyticsProvider((event, properties) => { tracked.push({ event, ...properties }); });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    setAnalyticsProvider(null);
    stopPzn?.();
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
      stopPzn = decoratePznSlots(document);
      // 2026-09-22 CLS fix: preview now goes through the same brief
      // hide-while-resizing cross-fade as every other path (see pzn.js's
      // crossFadeApply) — still no decision call, but no longer instant.
      await new Promise((r) => { setTimeout(r, 300); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
      expect(document.cookie).to.not.include(COOKIE_NAME);
      expect(decisionCalled).to.be.false;
    });

    it('matches a mixed-case sheet row to a mixed-case authored placement (B2)', async () => {
      const section = setupSection();
      section.dataset.pzn = 'HERO-cta';
      setConsent({ analytics: true }); // so a fallback event would be recorded
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ placement: ' Hero-CTA ' })])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
      expect(tracked.some((e) => e.reason === 'no_variant_authored')).to.equal(false);
    });

    it('reports placement and variantId as typed while matching case-insensitively (B2)', async () => {
      const section = setupSection();
      section.dataset.pzn = 'HERO-cta';
      setConsent({ analytics: true });
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ placement: 'Hero-CTA' })])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); });

      const applied = tracked.find((e) => e.event === 'personalization_applied');
      expect(applied.placement).to.equal('Hero-CTA');
      expect(applied.variantId).to.equal('Hero-CTA:enterprise:Enterprise CTA');
      expect(JSON.parse(sessionStorage.getItem('pzn-variants-cache-v1'))[0].placement).to.equal('Hero-CTA');
      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
    });

    it('reports the section placement as typed in a fallback (B2)', async () => {
      const section = setupSection();
      section.dataset.pzn = 'HERO-cta';
      setConsent({ analytics: true });
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ placement: 'Hero-CTA' })])]]);

      const { decoratePznSlots } = await freshPzn('?segment=nobody');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 100); });

      const fallback = tracked.find((e) => e.event === 'personalization_fallback');
      expect(fallback.placement).to.equal('HERO-cta');
      expect(fallback.reason).to.equal('no_variant_for_segment');
    });

    it('a storage write error does not discard a good fetch (B2 review)', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
      try {
        const { decoratePznSlots } = await freshPzn('?segment=enterprise');
        stopPzn = decoratePznSlots(document);
        await new Promise((r) => { setTimeout(r, 300); });
      } finally {
        Storage.prototype.setItem = original;
      }
      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
    });

    it('a storage read error does not skip the fetch (B2 review)', async () => {
      const section = setupSection();
      let fetched = false;
      mockFetch([[FIXTURE_URL, () => {
        fetched = true;
        return variantsResponse([variantRow()]);
      }]]);
      // Same stub shape as visitor-id.test.js: every storage read throws.
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
      try {
        const { decoratePznSlots } = await freshPzn('?segment=enterprise');
        stopPzn = decoratePznSlots(document);
        await new Promise((r) => { setTimeout(r, 300); });
      } finally {
        Storage.prototype.getItem = original;
      }
      expect(fetched).to.equal(true);
      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
    });

    it('normalises a mixed-case placement read from the session cache (B2)', async () => {
      const section = setupSection();
      section.dataset.pzn = 'Hero-Cta';
      sessionStorage.setItem('pzn-variants-cache-v1', JSON.stringify([variantRow({ placement: 'HERO-CTA' })]));
      mockFetch([]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
    });

    it('leaves baseline content when no row matches the previewed segment', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);

      const { decoratePznSlots } = await freshPzn('?segment=nonexistent-segment');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
    });
  });

  describe('warm visit (cookie already set)', () => {
    it('applies with no decision call — no longer instant as of the 2026-09-22 CLS fix', async () => {
      const section = setupSection();
      document.cookie = `${COOKIE_NAME}=enterprise; path=/`;
      let decisionCalled = false;
      mockFetch([
        [DECISION_URL, () => { decisionCalled = true; return { ok: true, json: async () => ({ segment: 'enterprise' }) }; }],
        [FIXTURE_URL, () => variantsResponse([variantRow()])],
      ]);

      const { decoratePznSlots } = await freshPzn();
      stopPzn = decoratePznSlots(document);
      // Still no network wait (decisionCalled stays false) — but warm visits
      // now go through the same brief hide-while-resizing cross-fade as
      // every other path, so this is no longer a zero-delay swap.
      await new Promise((r) => { setTimeout(r, 300); });

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
      stopPzn = decoratePznSlots(document);
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
      stopPzn = decoratePznSlots(document); // consent never granted in this test
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
      stopPzn = decoratePznSlots(document);
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
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); }); // real cross-fade, see 2026-09-22 CLS fix

      expect(section.querySelector('.cta-link').textContent).to.equal('Default Variant');
    });

    it('excludes a row past its commit_until date — bug-squash fix, 2026-08-28', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([
        variantRow({ commit_until: '2020-01-01' }), // expired
      ])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
    });

    it('keeps a row with a blank commit_until (permanent, no expiry)', async () => {
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ commit_until: '' })])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); }); // real cross-fade, see 2026-09-22 CLS fix

      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
    });

    it('does not throw on a corrupted sessionStorage cache — bug-squash fix, 2026-08-28', async () => {
      sessionStorage.setItem('pzn-variants-cache-v1', '{not valid json');
      const section = setupSection();
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      expect(() => { stopPzn = decoratePznSlots(document); }).to.not.throw();
      await new Promise((r) => { setTimeout(r, 50); });

      // B2 review: a corrupt cache now counts as no cache (readCache), so the
      // sheet is fetched and the variant applies, instead of failing open to [].
      await new Promise((r) => { setTimeout(r, 250); });
      expect(section.querySelector('.cta-link').textContent).to.equal('Enterprise CTA');
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
        stopPzn = decoratePznSlots(document);
        await new Promise((r) => { setTimeout(r, 50); });
      } finally {
        window.removeEventListener('unhandledrejection', onRejection);
      }

      expect(rejection).to.equal(null);
      expect(section.querySelector('.cta-link').textContent).to.equal('Default CTA');
    });
  });

  describe('weighted split (weightedPick)', () => {
    it('sticky-splits distinct visitors across both variants of a real 50/50 row pair', async function stickySplitTest() {
      // 12 iterations x the real ~300ms cross-fade (2026-09-22 CLS fix) run
      // sequentially and exceed mocha's 2000ms default — a real function,
      // not an arrow, so `this` is mocha's own test context.
      this.timeout(6000);
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
        stopPzn = decoratePznSlots(document);
        // eslint-disable-next-line no-await-in-loop -- real cross-fade, see 2026-09-22 CLS fix
        await new Promise((r) => { setTimeout(r, 300); });
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
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); });

      expect(calledUrl).to.not.include('evil.example');
    });
  });

  describe('fallback reason logging (EXP-014)', () => {
    it('logs no_variant_authored when nothing is authored for this placement', async () => {
      setupSection();
      setConsent({ analytics: true });
      mockFetch([[FIXTURE_URL, () => variantsResponse([])]]);

      const { decoratePznSlots } = await freshPzn();
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(tracked).to.have.length(1);
      expect(tracked[0].event).to.equal('personalization_fallback');
      expect(tracked[0].reason).to.equal('no_variant_authored');
      expect(tracked[0].placement).to.equal('hero-cta');
      expect(tracked[0].segment).to.equal(null);
    });

    it('logs consent_denied on a cold visit with no personalization consent', async () => {
      setupSection();
      setConsent({ analytics: true }); // personalization NOT granted
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);

      const { decoratePznSlots } = await freshPzn();
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(tracked).to.have.length(1);
      expect(tracked[0].reason).to.equal('consent_denied');
    });

    it('logs decision_failed when the decision endpoint errors', async () => {
      setupSection();
      setConsent({ personalization: true, analytics: true });
      mockFetch([
        [DECISION_URL, () => ({ ok: false, status: 500 })],
        [FIXTURE_URL, () => variantsResponse([variantRow()])],
      ]);

      const { decoratePznSlots } = await freshPzn();
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 300); });

      expect(tracked.some((e) => e.reason === 'decision_failed')).to.be.true;
    });

    it('logs no_variant_for_segment when the resolved segment has no matching row', async () => {
      setupSection();
      setConsent({ analytics: true });
      // only an 'enterprise' row exists
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);

      const { decoratePznSlots } = await freshPzn('?segment=default');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(tracked).to.have.length(1);
      expect(tracked[0].reason).to.equal('no_variant_for_segment');
      expect(tracked[0].segment).to.equal('default');
    });

    it('logs selector_not_found when the authored selector matches nothing in this section', async () => {
      setupSection();
      setConsent({ analytics: true });
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ selector: '.does-not-exist' })])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(tracked).to.have.length(1);
      expect(tracked[0].reason).to.equal('selector_not_found');
    });

    it('logs invalid_selector on a syntactically malformed authored selector', async () => {
      setupSection();
      setConsent({ analytics: true });
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow({ selector: '[' })])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(tracked).to.have.length(1);
      expect(tracked[0].reason).to.equal('invalid_selector');
    });

    it('does not log a fallback event on a successful apply', async () => {
      setupSection();
      setConsent({ analytics: true });
      mockFetch([[FIXTURE_URL, () => variantsResponse([variantRow()])]]);

      const { decoratePznSlots } = await freshPzn('?segment=enterprise');
      stopPzn = decoratePznSlots(document);
      await new Promise((r) => { setTimeout(r, 50); });

      expect(tracked.some((e) => e.event === 'personalization_fallback')).to.be.false;
    });
  });
});
