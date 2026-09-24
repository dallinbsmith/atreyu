import { expect } from '@esm-bundle/chai';
// eslint-disable-next-line import/no-relative-packages -- parity check against the vendored plugin
import { toClassName } from '../../../plugins/experimentation/src/index.js';
import {
  AUDIENCES, AUDIENCE_NAMES, CATALOG, materializeCatalog, toAudienceMap, withCampaigns,
} from '../../../scripts/utils/experiments/audiences.js';

const catalogEntry = (id, test) => ({
  id,
  label: id,
  description: id,
  consent: 'contextual',
  test,
});

describe('scripts/utils/experiments/audiences.js', () => {
  const realMatchMedia = window.matchMedia;
  const realUrl = window.location.href;

  beforeEach(() => {
    window.matchMedia = (query) => ({ matches: query.includes('>= 768px') });
    history.replaceState({}, '', '/audiences-test');
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
    history.replaceState({}, '', realUrl);
  });

  it('keeps the live catalog order and derives runtime audiences in that order', () => {
    expect(CATALOG.map(({ id }) => id)).to.deep.equal(['mobile', 'desktop', 'campaign-*']);
    expect(Object.keys(AUDIENCES)).to.deep.equal(['mobile', 'desktop']);
    expect(AUDIENCE_NAMES).to.deep.equal(['mobile', 'desktop']);
  });

  it('inserts campaign audiences at the catalog placeholder position', () => {
    const audiences = withCampaigns(['Fall Launch', 'campaign_Retargeting']);
    expect(Object.keys(audiences)).to.deep.equal([
      'mobile',
      'desktop',
      'campaign-fall-launch',
      'campaign-retargeting',
    ]);
  });

  it('does not mutate AUDIENCES and returns a fresh object on every call', () => {
    const before = Object.keys(AUDIENCES);
    const first = withCampaigns(['one']);
    const second = withCampaigns(['one']);
    const noCampaigns = withCampaigns(null);

    expect(Object.keys(AUDIENCES)).to.deep.equal(before);
    expect(second).not.to.equal(first);
    expect(Object.keys(second)).to.deep.equal(['mobile', 'desktop', 'campaign-one']);
    expect(Object.keys(first)).to.deep.equal(['mobile', 'desktop', 'campaign-one']);
    expect(Object.keys(noCampaigns)).to.deep.equal(['mobile', 'desktop']);
  });

  it('normalizes campaign ids with plugin toClassName parity', () => {
    const samples = ['Paid Search US', 'Retargeting Audience', 'Créatif été', 'already--spaced'];
    const ids = Object.keys(withCampaigns(samples)).slice(2);
    expect(ids).to.deep.equal(samples.map((sample) => `campaign-${toClassName(sample)}`));
  });

  it('resolves campaign audiences from UTM values', async () => {
    const audiences = withCampaigns(['Fall Launch']);
    history.replaceState({}, '', '/audiences-test?utm_campaign=Fall%20Launch');
    expect(await audiences['campaign-fall-launch']()).to.equal(true);
    history.replaceState({}, '', '/audiences-test?utm_campaign=&campaign=Fall%20Launch');
    expect(await audiences['campaign-fall-launch']()).to.equal(true);
    history.replaceState({}, '', '/audiences-test?utm_campaign=Other');
    expect(await audiences['campaign-fall-launch']()).to.equal(false);
  });

  it('records a consent class on every catalog entry', () => {
    expect(Object.fromEntries(CATALOG.map(({ id, consent }) => [id, consent]))).to.deep.equal({
      mobile: 'contextual',
      desktop: 'contextual',
      'campaign-*': 'contextual',
    });
  });

  it('materializes catalog entries without mutating the catalog', () => {
    const entries = materializeCatalog(['one', null, '!!!']);
    expect(entries.map(({ id }) => id)).to.deep.equal(['mobile', 'desktop', 'campaign-one']);
    expect(CATALOG.map(({ id }) => id)).to.deep.equal(['mobile', 'desktop', 'campaign-*']);
  });

  it('inserts campaigns where the catalog slot appears, including the middle', () => {
    const entries = materializeCatalog(['one'], [
      catalogEntry('before', () => true),
      CATALOG[2],
      catalogEntry('after', () => true),
    ]);
    expect(entries.map(({ id }) => id)).to.deep.equal(['before', 'campaign-one', 'after']);
  });

  it('freezes the exported catalog and audience map', () => {
    expect(Object.isFrozen(CATALOG)).to.equal(true);
    expect(CATALOG.every(Object.isFrozen)).to.equal(true);
    expect(Object.isFrozen(AUDIENCES)).to.equal(true);
  });

  it('does not statically import the vendored plugin from runtime audience modules', async () => {
    const [audiencesSource, loaderSource] = await Promise.all([
      fetch('/scripts/utils/experiments/audiences.js').then((r) => r.text()),
      fetch('/scripts/experiment-loader.js').then((r) => r.text()),
    ]);
    expect(audiencesSource).not.to.include('plugins/experimentation');
    expect(loaderSource).not.to.match(/^import .*plugins\/experimentation/m);
  });

  it('supports future edge-fed and composite audiences as AND over parts', async () => {
    const signals = { desktop: true, country: false, enterprise: true };
    const audiences = toAudienceMap([
      catalogEntry('desktop', () => signals.desktop),
      catalogEntry('country-us', () => signals.country),
      catalogEntry('enterprise', () => signals.enterprise),
      catalogEntry('async-false', async () => false),
      {
        id: 'desktop-us',
        label: 'Desktop US',
        description: 'Desktop and country US.',
        consent: 'contextual',
        all: ['desktop', 'country-us'],
      },
      {
        id: 'desktop-enterprise',
        label: 'Desktop enterprise',
        description: 'Desktop and enterprise account.',
        consent: 'contextual',
        all: ['desktop', 'enterprise'],
      },
      {
        id: 'desktop-async',
        label: 'Desktop async',
        description: 'Desktop and async false.',
        consent: 'contextual',
        all: ['desktop', 'async-false'],
      },
    ]);

    expect(await audiences['desktop-us']()).to.equal(false);
    expect(await audiences['desktop-enterprise']()).to.equal(true);
    expect(await audiences['desktop-async']()).to.equal(false);
    signals.country = true;
    expect(await audiences['desktop-us']()).to.equal(true);
    signals.desktop = false;
    expect(await audiences['desktop-us']()).to.equal(false);
    expect(await audiences['desktop-enterprise']()).to.equal(false);
  });

  it('resolves empty and failed composite parts as false without rejecting', async () => {
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args);
    try {
      const audiences = toAudienceMap([
        catalogEntry('ok', () => true),
        catalogEntry('throws', () => { throw new Error('boom'); }),
        catalogEntry('rejects', () => Promise.reject(new Error('edge'))),
        {
          id: 'empty',
          label: 'Empty',
          description: 'Empty composite.',
          consent: 'contextual',
          all: [],
        },
        {
          id: 'with-throw',
          label: 'With throw',
          description: 'Throwing part.',
          consent: 'contextual',
          all: ['ok', 'throws', 'rejects'],
        },
      ]);

      expect(await audiences.empty()).to.equal(false);
      expect(await audiences['with-throw']()).to.equal(false);
      expect(warnings[0][0]).to.contain('Audience "throws" failed');
      expect(warnings[1][0]).to.contain('Audience "rejects" failed');
    } finally {
      console.warn = realWarn;
    }
  });

  it('rejects invalid composite catalog definitions', () => {
    expect(() => toAudienceMap([
      catalogEntry('a', () => true),
      { id: 'self', label: 'Self', description: 'Self', consent: 'contextual', all: ['self'] },
    ])).to.throw('cannot reference itself');
    expect(() => toAudienceMap([
      { id: 'a', label: 'A', description: 'A', consent: 'contextual', all: ['missing'] },
    ])).to.throw('unknown audience "missing"');
    expect(() => toAudienceMap([
      { id: 'a', label: 'A', description: 'A', consent: 'contextual', all: ['b'] },
      { id: 'b', label: 'B', description: 'B', consent: 'contextual', all: ['a'] },
    ])).to.throw('Audience cycle detected');
    expect(() => toAudienceMap([
      {
        id: 'both',
        label: 'Both',
        description: 'Both',
        consent: 'contextual',
        all: ['a'],
        test: () => true,
      },
      catalogEntry('a', () => true),
    ])).to.throw('cannot define both all and test');
    expect(() => toAudienceMap([
      { id: 'bad-all', label: 'Bad all', description: 'Bad all', consent: 'contextual', all: 'a' },
      catalogEntry('a', () => true),
    ])).to.throw('all must be an array');
  });
});
