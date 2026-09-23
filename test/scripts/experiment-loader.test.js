import { expect } from '@esm-bundle/chai';
import { setConsent, resetConsent } from '../../scripts/utils/analytics/consent.js';
import { setAnalyticsProvider } from '../../scripts/utils/analytics/analytics.js';
import {
  isEnabled, trackExposures, restoreAssignments, persistAssignments, runExperimentation,
} from '../../scripts/experiment-loader.js';

const KEY = 'unified-decisioning-experiments';
const realFetch = window.fetch;
let tracked;

const exp = (overrides = {}) => ({
  type: 'section',
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
    document.head.querySelectorAll('meta[name^="experiment"]').forEach((m) => m.remove());
    document.body.innerHTML = '';
  });

  afterEach(() => {
    window.fetch = realFetch;
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
      restoreAssignments();
      persistAssignments();
      expect(localStorage.getItem(KEY)).to.equal(null);
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

    it('serves control with no fetch when the split sends everyone to control', async () => {
      setConsent({ analytics: true });
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
  });
});
