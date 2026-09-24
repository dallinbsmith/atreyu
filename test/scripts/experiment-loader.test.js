import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { setConsent, resetConsent } from '../../scripts/utils/analytics/consent.js';
import { setAnalyticsProvider } from '../../scripts/utils/analytics/analytics.js';
import { loadArea, setConfig } from '../../scripts/ak.js';
import {
  config, isEnabled, trackExposures, restoreAssignments, persistAssignments, runExperimentation,
} from '../../scripts/experiment-loader.js';

const KEY = 'unified-decisioning-experiments';
const PLUGIN_CONSENT_KEY = 'experimentation-consented';
const realFetch = window.fetch;
const realMatchMedia = window.matchMedia;
let tracked;
let clock;

const exp = (overrides = {}) => ({
  type: 'section',
  servedExperience: '/v/hero-test',
  config: {
    id: 'hero-test', selectedVariant: 'challenger-1', run: true, resolvedAudiences: null, ...overrides,
  },
});

const sectionWithExperiment = (split) => {
  document.body.innerHTML = `<main><div>
    <h1 id="headline">Control headline</h1>
    <div class="section-metadata">
      <div><div>Experiment</div><div>Hero Test</div></div>
      <div><div>Experiment Variants</div><div><a href="/variants/hero-b">/variants/hero-b</a></div></div>
      <div><div>Experiment Split</div><div>${split}</div></div>
    </div>
  </div></main>`;
};

describe('scripts/experiment-loader.js', () => {
  beforeEach(() => {
    tracked = [];
    setAnalyticsProvider((event, props) => tracked.push({ event, props }));
    resetConsent();
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    localStorage.removeItem(PLUGIN_CONSENT_KEY);
    document.head.querySelectorAll('meta[name^="experiment"],meta[name^="audience"],meta[name^="campaign"],meta[property^="audience:"],meta[property^="campaign:"]').forEach((m) => m.remove());
    document.body.innerHTML = '';
    window.matchMedia = (query) => ({ matches: query.includes('< 768px') });
    setConfig({ locales: { '': {} }, linkBlocks: [], components: [], decorateArea: () => {} });
  });

  afterEach(() => {
    window.fetch = realFetch;
    window.matchMedia = realMatchMedia;
    clock?.restore();
    clock = null;
  });

  describe('isEnabled', () => {
    it('is false with no experimentation metadata (plugin never imported)', () => {
      document.body.innerHTML = '<main><div><p>plain</p></div></main>';
      expect(isEnabled()).to.equal(false);
    });

    it('detects page-level experiment metadata', () => {
      const meta = document.createElement('meta');
      meta.name = 'experiment';
      meta.content = 'Hero Test';
      document.head.append(meta);
      expect(isEnabled()).to.equal(true);
    });

    it('detects section-level experiment metadata', () => {
      sectionWithExperiment('50');
      expect(isEnabled()).to.equal(true);
    });
  });

  describe('trackExposures', () => {
    it('emits one EXPERIMENT event per experiment that ran, in the existing schema', () => {
      setConsent({ analytics: true });
      trackExposures([exp()]);
      expect(tracked).to.have.length(1);
      const { event, props } = tracked[0];
      expect(event).to.equal('experiment');
      expect(props).to.include({
        experiment: 'hero-test',
        variantName: 'challenger-1',
        variantId: 'hero-test:challenger-1',
        variantType: 'a-b-split-test',
        renderType: 'section-swap',
      });
      expect(props.anonId).to.be.a('string');
    });

    it('skips experiments that did not run (would pollute the control arm)', () => {
      setConsent({ analytics: true });
      trackExposures([exp({ run: false, selectedVariant: undefined })]);
      expect(tracked).to.have.length(0);
    });

    it('labels audience-restricted experiments (personalization holdout pattern)', () => {
      setConsent({ analytics: true });
      trackExposures([exp({ resolvedAudiences: ['mobile'] })]);
      expect(tracked[0].props.variantType).to.equal('audience-experiment');
      expect(tracked[0].props.audiences).to.deep.equal(['mobile']);
    });

    it('reports control when a challenger was selected but not served', () => {
      setConsent({ analytics: true });
      trackExposures([{ ...exp({ selectedVariant: 'challenger-1' }), servedExperience: null }]);
      expect(tracked[0].props.variantName).to.equal('control');
      expect(tracked[0].props.variantId).to.equal('hero-test:control');
    });

    it('reports the challenger when the plugin marks it served', () => {
      setConsent({ analytics: true });
      trackExposures([{ ...exp(), servedExperience: '/v/hero' }]);
      expect(tracked[0].props.variantName).to.equal('challenger-1');
    });

    it('never tracks a forced ?experiment= preview', () => {
      setConsent({ analytics: true });
      window.history.replaceState({}, '', '?experiment=hero-test/challenger-1');
      trackExposures([exp()]);
      window.history.replaceState({}, '', window.location.pathname);
      expect(tracked).to.have.length(0);
    });
  });

  describe('assignment stickiness', () => {
    it('with consent, restores a prior assignment into the plugin session store', () => {
      setConsent({ personalization: true });
      localStorage.setItem(KEY, '{"hero-test":{"treatment":"challenger-1"}}');
      restoreAssignments();
      expect(sessionStorage.getItem(KEY)).to.contain('challenger-1');
    });

    it('with consent, persists the session assignment across sessions', () => {
      setConsent({ personalization: true });
      sessionStorage.setItem(KEY, '{"hero-test":{"treatment":"control"}}');
      persistAssignments();
      expect(localStorage.getItem(KEY)).to.contain('control');
    });

    it('without consent, never persists and clears any stored assignment', () => {
      localStorage.setItem(KEY, '{"hero-test":{"treatment":"control"}}');
      sessionStorage.setItem(KEY, '{"hero-test":{"treatment":"control"}}');
      localStorage.setItem(PLUGIN_CONSENT_KEY, 'true');
      restoreAssignments();
      persistAssignments();
      expect(localStorage.getItem(KEY)).to.equal(null);
      expect(localStorage.getItem(PLUGIN_CONSENT_KEY)).to.equal(null);
    });
  });

  describe('runExperimentation (real vendored plugin)', () => {
    it('returns null and does nothing when the page has no experiment', async () => {
      document.body.innerHTML = '<main><div><p>plain</p></div></main>';
      expect(await runExperimentation()).to.equal(null);
    });

    it('swaps a section-level challenger before decoration and tracks the exposure', async () => {
      setConsent({ analytics: true, personalization: true });
      window.fetch = async () => new Response(
        '<html><body><main><div><h1 id="headline">Challenger headline</h1></div></main></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
      sectionWithExperiment('100');
      await runExperimentation();
      expect(document.querySelector('#headline').textContent).to.equal('Challenger headline');
      const exposure = tracked.find((t) => t.event === 'experiment');
      expect(exposure.props.variantName).to.equal('challenger-1');
      expect(localStorage.getItem(KEY)).to.contain('challenger-1');
    });

    it('without personalization consent, never runs the plugin or writes storage', async () => {
      setConsent({ analytics: true });
      sessionStorage.setItem(KEY, '{"stale":{}}');
      let fetched = false;
      window.fetch = async () => {
        fetched = true;
        return new Response('');
      };
      sectionWithExperiment('100');
      expect(await runExperimentation()).to.equal(null);
      expect(fetched).to.equal(false);
      expect(document.querySelector('#headline').textContent).to.equal('Control headline');
      expect(tracked.find((t) => t.event === 'experiment')).to.equal(undefined);
      expect(sessionStorage.getItem(KEY)).to.equal(null);
    });

    it('serves control with no fetch when the split sends everyone to control', async () => {
      setConsent({ analytics: true, personalization: true });
      let fetched = false;
      window.fetch = async () => {
        fetched = true;
        return new Response('');
      };
      sectionWithExperiment('0');
      await runExperimentation();
      expect(fetched).to.equal(false);
      expect(document.querySelector('#headline').textContent).to.equal('Control headline');
      expect(tracked.find((t) => t.event === 'experiment').props.variantName).to.equal('control');
    });

    const pageWithTable = (split) => {
      document.body.innerHTML = `<main><div><h1 id="headline">Control headline</h1></div>
        <div><div class="experiment">
          <div><div>Test Name</div><div>Table Test</div></div>
          <div><div>Variants</div><div><a href="/variants/table-b">/variants/table-b</a></div></div>
          <div><div>Split</div><div>${split}</div></div>
        </div></div></main>`;
    };

    it('runs a whole-page test authored in the Experiment table', async () => {
      setConsent({ analytics: true, personalization: true });
      const requested = [];
      window.fetch = async (url) => {
        requested.push(`${url}`);
        return new Response(
          '<html><head></head><body><main><div><h1 id="headline">Challenger headline</h1></div></main></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      };
      pageWithTable('100');
      await runExperimentation();
      expect(requested.some((u) => u.includes('/variants/table-b'))).to.equal(true);
      expect(document.querySelector('#headline').textContent).to.equal('Challenger headline');
      expect(Boolean(document.querySelector('.experiment'))).to.equal(false);
      expect(tracked.find((t) => t.event === 'experiment').props.variantId).to.equal('table-test:challenger-1');
    });

    it('without consent, still removes the Experiment table and serves control', async () => {
      window.fetch = async () => { throw new Error('no fetch expected'); };
      pageWithTable('100');
      expect(await runExperimentation()).to.equal(null);
      expect(Boolean(document.querySelector('.experiment'))).to.equal(false);
      expect(document.querySelectorAll('main > div').length).to.equal(1);
      expect(document.querySelector('#headline').textContent).to.equal('Control headline');
    });

    it('times out a hanging /v/ variant fetch and keeps original content', async () => {
      clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      setConsent({ analytics: true, personalization: true });
      document.body.innerHTML = `<main><div>
        <h1 id="headline">Control headline</h1>
        <div class="section-metadata">
          <div><div>Audience: mobile</div><div><a href="/v/hang">/v/hang</a></div></div>
        </div>
      </div></main>`;
      const calls = [];
      window.fetch = (url, init = {}) => {
        calls.push({
          path: new URL(url, window.location.origin).pathname,
          hasSignal: Boolean(init.signal),
        });
        return new Promise((resolve, reject) => {
          if (init.signal?.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      };
      const hangingFetch = window.fetch;

      let completed = false;
      const pending = runExperimentation().finally(() => {
        completed = true;
      });
      await clock.tickAsync(1000);
      await Promise.resolve();

      expect(completed).to.equal(true);
      await pending;
      expect(calls).to.deep.equal([{ path: '/v/hang', hasSignal: true }]);
      expect(document.querySelector('#headline').textContent).to.equal('Control headline');
      expect(window.fetch).to.equal(hangingFetch);
    });

    it('fails fast when a section /v/ fetch starts after a page-level audience timeout', async () => {
      clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      setConsent({ analytics: true, personalization: true });
      const meta = document.createElement('meta');
      meta.name = 'audience-mobile';
      meta.content = '/v/page-hang';
      document.head.append(meta);
      document.body.innerHTML = `<main><div>
        <h1 id="headline">Control headline</h1>
        <div class="section-metadata">
          <div><div>Audience: mobile</div><div><a href="/v/section-hang">/v/section-hang</a></div></div>
        </div>
      </div></main>`;
      const calls = [];
      window.fetch = (url, init = {}) => {
        calls.push({
          path: new URL(url, window.location.origin).pathname,
          hasSignal: Boolean(init.signal),
          abortedAtCall: Boolean(init.signal?.aborted),
        });
        return new Promise((resolve, reject) => {
          if (init.signal?.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      };

      let completed = false;
      const pending = runExperimentation().finally(() => {
        completed = true;
      });
      await clock.tickAsync(1000);
      await pending;

      expect(completed).to.equal(true);
      expect(calls).to.deep.equal([
        { path: '/v/page-hang', hasSignal: true, abortedAtCall: false },
        { path: '/v/section-hang', hasSignal: true, abortedAtCall: true },
      ]);
      expect(document.querySelector('#headline').textContent).to.equal('Control headline');
    });

    it('carries Style and Anchor through a section swap before loadArea decorates sections', async () => {
      setConsent({ analytics: true, personalization: true });
      document.body.innerHTML = `<main><div>
        <h1 id="headline">Control headline</h1>
        <div class="section-metadata">
          <div><div>Audience: mobile</div><div><a href="/v/mobile">/v/mobile</a></div></div>
          <div><div>Style</div><div>dark</div></div>
          <div><div>Anchor</div><div>Hero</div></div>
        </div>
      </div></main>`;
      window.fetch = async () => new Response(
        '<html><body><main><div><h1 id="headline">Mobile headline</h1></div></main></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } },
      );

      await runExperimentation();
      expect(document.querySelector('#headline').textContent).to.equal('Mobile headline');
      expect(document.querySelector('.section-metadata').textContent).to.contain('dark');
      expect(document.querySelector('main > div').classList.contains('dark')).to.equal(false);

      await loadArea();

      expect(document.querySelector('main > div').classList.contains('dark')).to.equal(true);
      expect(document.querySelector('main > div').id).to.equal('hero');
      expect(Boolean(document.querySelector('.section-metadata'))).to.equal(false);
    });

    it('does not duplicate Style and Anchor when the variant has its own metadata', async () => {
      setConsent({ analytics: true, personalization: true });
      document.body.innerHTML = `<main><div>
        <h1 id="headline">Control headline</h1>
        <div class="section-metadata">
          <div><div>Audience: mobile</div><div><a href="/v/mobile">/v/mobile</a></div></div>
          <div><div>Style</div><div>dark</div></div>
          <div><div>Anchor</div><div>Hero</div></div>
        </div>
      </div></main>`;
      window.fetch = async () => new Response(
        `<html><body><main><div><h1 id="headline">Mobile headline</h1>
          <div class="section-metadata">
            <div><div>Style</div><div>light</div></div>
            <div><div>Anchor</div><div>Variant Hero</div></div>
          </div>
        </div></main></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );

      await runExperimentation();
      expect(document.querySelectorAll('.section-metadata')).to.have.length(1);
      expect(document.querySelector('.section-metadata').textContent).to.contain('light');
      expect(document.querySelector('.section-metadata').textContent).not.to.contain('dark');

      await loadArea();

      const section = document.querySelector('main > div');
      expect(section.classList.contains('light')).to.equal(true);
      expect(section.classList.contains('dark')).to.equal(false);
      expect(section.id).to.equal('variant-hero');
    });

    it('removes config blocks left behind inside variant content', async () => {
      setConsent({ analytics: true, personalization: true });
      document.body.innerHTML = `<main><div>
        <h1 id="headline">Control headline</h1>
        <div class="section-metadata">
          <div><div>Audience: mobile</div><div><a href="/v/mobile">/v/mobile</a></div></div>
        </div>
      </div></main>`;
      window.fetch = async () => new Response(
        `<html><body><main><div>
          <h1 id="headline">Mobile headline</h1>
          <div class="personalize"><div>Leftover config</div></div>
        </div></main></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );

      await runExperimentation();

      expect(document.querySelector('#headline')?.textContent).to.equal('Mobile headline');
      expect(Boolean(document.querySelector('.personalize'))).to.equal(false);
    });

    describe('personalize tables', () => {
      // End Date is YYYY-MM-DD only; 30 days out stays within the 180-day cap.
      const soon = ((d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()]
        .map((n) => `${n}`.padStart(2, '0')).join('-'))(new Date(Date.now() + 30 * 864e5));
      const personalizeSection = (id, path, extra = '') => `<main><div>
        <h1 id="headline">Control headline</h1>
        <div class="personalize">
          <div><div>Name</div><div>Hero</div></div>
          <div><div>Audience: ${id}</div><div><a href="${path}">${path}</a></div></div>
          <div><div>End Date</div><div>${soon}</div></div>${extra}
        </div>
      </div></main>`;
      const variant = (headline) => async (url) => new Response(
        `<html><body><main><div><h1 id="headline">${headline} ${new URL(url, window.location.origin).pathname}</h1></div></main></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
      const originalSearch = window.location.search;
      afterEach(() => window.history.replaceState({}, '', `${window.location.pathname}${originalSearch}`));

      it('compiles the table before the plugin runs and serves the matching variant', async () => {
        setConsent({ analytics: true, personalization: true });
        document.body.innerHTML = personalizeSection('mobile', '/v/p/home/mobile');
        window.fetch = variant('Served');
        await runExperimentation();
        expect(document.querySelector('#headline').textContent).to.equal('Served /v/p/home/mobile');
        expect(Boolean(document.querySelector('.personalize'))).to.equal(false);
        expect(window.hlx.audiences[0].config.selectedAudience).to.equal('mobile');
      });

      it('passes a fresh audience map per run, so campaign audiences from the table resolve', async () => {
        setConsent({ analytics: true, personalization: true });
        window.history.replaceState({}, '', `${window.location.pathname}?utm_campaign=Launch`);
        document.body.innerHTML = personalizeSection('campaign-launch', '/v/p/home/launch');
        window.fetch = variant('Served');
        await runExperimentation();
        expect(document.querySelector('#headline').textContent).to.equal('Served /v/p/home/launch');

        // Next run (a dapreview re-render): a different campaign, no stale entry.
        window.history.replaceState({}, '', `${window.location.pathname}?utm_campaign=Other`);
        document.body.innerHTML = personalizeSection('campaign-launch', '/v/p/home/launch');
        await runExperimentation();
        expect(document.querySelector('#headline').textContent).to.equal('Control headline');
        expect(document.body.dataset.audiences).to.equal('mobile,desktop,campaign-launch');
      });

      it('without consent, still compiles and removes the table but never runs the plugin', async () => {
        document.body.innerHTML = personalizeSection('mobile', '/v/p/home/mobile');
        const calls = [];
        window.fetch = async (url) => {
          calls.push(new URL(url, window.location.origin).pathname);
          return new Response('');
        };
        expect(await runExperimentation()).to.equal(null);
        expect(Boolean(document.querySelector('.personalize'))).to.equal(false);
        expect(document.querySelector('.section-metadata').textContent).to.contain('Audience: mobile');
        expect(document.querySelector('#headline').textContent).to.equal('Control headline');
        expect(calls.filter((path) => path.startsWith('/v/'))).to.deep.equal([]);
      });

      it('a compile error is only logged: the table is removed and the page still renders', async () => {
        const log = sinon.spy();
        setConfig({
          locales: { '': {} }, linkBlocks: [], components: [], decorateArea: () => {}, log,
        });
        const isProd = sinon.stub(config, 'isProd').throws(new Error('compile boom'));
        try {
          document.body.innerHTML = personalizeSection('mobile', '/v/p/home/mobile');
          expect(await runExperimentation()).to.equal(null);
          expect(log.calledWithMatch(sinon.match.has('message', 'compile boom'))).to.equal(true);
          expect(Boolean(document.querySelector('.personalize'))).to.equal(false);
          expect(Boolean(document.querySelector('.section-metadata'))).to.equal(false);
          await loadArea();
          expect(document.querySelector('#headline').textContent).to.equal('Control headline');
        } finally {
          isProd.restore();
        }
      });

      // ?audience= is a preview param, so the plugin runs without consent;
      // fetch is stubbed (an unstubbed /v/ fetch hits the WTR dev server).
      [
        { prod: true, headline: 'Control headline', warned: false },
        { prod: false, headline: 'Served /v/p/home/mobile', warned: true },
      ].forEach(({ prod, headline, warned }) => {
        it(`passes the prod flag (${prod}): inactive ?audience= preview ${prod ? 'off, no warnings' : 'on, warnings'}`, async () => {
          const isProd = sinon.stub(config, 'isProd').returns(prod);
          const warn = sinon.stub(console, 'warn');
          try {
            window.history.replaceState({}, '', `${window.location.pathname}?audience=mobile`);
            window.fetch = variant('Served');
            document.body.innerHTML = personalizeSection(
              'mobile',
              '/v/p/home/mobile',
              `<div><div>Status</div><div>Inactive</div></div>
              <div><div>Audience: nope</div><div>/v/p/home/nope</div></div>`,
            );
            await runExperimentation();
            expect(document.querySelector('#headline').textContent).to.equal(headline);
            expect(Boolean(document.querySelector('.personalize'))).to.equal(false);
            expect(warn.calledWithMatch(/unknown audience "nope"/)).to.equal(warned);
          } finally {
            warn.restore();
            isProd.restore();
          }
        });
      });
    });

    it('removes leftover config blocks before the page is decorated', async () => {
      document.body.innerHTML = `<main>
        <div><div class="experiment"><div>Invalid</div></div></div>
        <div><p id="keep">Keep</p><div class="personalize"><div>Invalid</div></div></div>
      </main>`;

      expect(await runExperimentation()).to.equal(null);

      expect(Boolean(document.querySelector('.experiment'))).to.equal(false);
      expect(Boolean(document.querySelector('.personalize'))).to.equal(false);
      expect([...document.querySelectorAll('main > div')].map((section) => section.textContent.trim()))
        .to.deep.equal(['Keep']);
    });
  });
});
