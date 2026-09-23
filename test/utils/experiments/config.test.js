import { expect } from '@esm-bundle/chai';
import {
  readExperiment, statusOf, validate, matchesPattern, toClassName, toList,
} from '../../../scripts/utils/experiments/config.js';
// eslint-disable-next-line import/no-relative-packages -- parity check against the vendored plugin
import * as plugin from '../../../plugins/experimentation/src/index.js';

const AUDIENCES = ['mobile', 'desktop'];
const realFetch = window.fetch;

const setMeta = (meta) => {
  document.head.querySelectorAll('meta[name^="experiment"]').forEach((m) => m.remove());
  for (const [name, content] of Object.entries(meta)) {
    document.head.append(Object.assign(document.createElement('meta'), { name, content }));
  }
};

const pluginConfig = async (meta) => {
  setMeta(meta);
  window.hlx = {};
  document.body.innerHTML = '<main><div><h1>Control</h1></div></main>';
  await plugin.loadEager(document, { audiences: { mobile: () => true, desktop: () => false } });
  return window.hlx.experiments.find((e) => e.type === 'page').config;
};

describe('scripts/utils/experiments/config.js', () => {
  before(() => {
    window.fetch = async () => new Response('<main><div><h1>Variant</h1></div></main>', { status: 200 });
  });
  after(() => {
    window.fetch = realFetch;
    setMeta({});
  });

  describe('parity with the vendored plugin', () => {
    it('matches toClassName and list parsing', () => {
      for (const s of ['Hero Test', ' A/B -- Test_2 ', 'ÄBC', '']) expect(toClassName(s)).to.equal(plugin.toClassName(s));
      expect(toList('/a, /b\n/c')).to.deep.equal(plugin.stringToArray('/a, /b\n/c').map((x) => x.trim()));
    });

    const cases = {
      'no split (even across control + variants)': { experiment: 'Hero Test', 'experiment-variants': '/v1, /v2' },
      'explicit split': { experiment: 'Hero', 'experiment-variants': '/v1, /v2', 'experiment-split': '20, 30' },
      'fewer splits than variants (plugin pads 0)': { experiment: 'Hero', 'experiment-variants': '/v1, /v2', 'experiment-split': '40' },
      'more splits than variants (plugin truncates)': { experiment: 'Hero', 'experiment-variants': '/v1', 'experiment-split': '10, 20' },
      'names and audiences': {
        experiment: 'Hero', 'experiment-variants': '/v1', 'experiment-name': 'Bold', 'experiment-audience': 'Mobile',
      },
    };
    for (const [name, meta] of Object.entries(cases)) {
      it(`computes the same variants as the plugin: ${name}`, async () => {
        const expected = await pluginConfig(meta);
        const actual = readExperiment(meta, window.location.pathname);
        expect(actual.id).to.equal(expected.id);
        expect(actual.audiences).to.deep.equal(expected.audiences);
        expect(actual.variants.map((v) => v.name)).to.deep.equal(expected.variantNames);
        actual.variants.forEach((v) => {
          const theirs = expected.variants[v.name];
          expect(v.label).to.equal(theirs.label);
          expect(v.split / 100).to.be.closeTo(Number.parseFloat(theirs.percentageSplit), 0.0001);
          expect(v.path).to.equal(theirs.pages[0]);
        });
      });
    }
  });

  describe('readExperiment', () => {
    it('accepts authored (spaced, title-case) keys and link arrays from section metadata', () => {
      const cfg = readExperiment({ Experiment: 'Hero Test', 'Experiment Variants': ['https://main--x--y.aem.page/v1'] }, '/p');
      expect(cfg.id).to.equal('hero-test');
      expect(cfg.variants[1].path).to.equal('/v1');
    });

    it('returns null without an experiment name', () => {
      expect(readExperiment({ 'experiment-variants': '/v1' })).to.equal(null);
    });
  });

  describe('statusOf', () => {
    const base = readExperiment({ experiment: 'x', 'experiment-variants': '/v' });
    const now = new Date('2026-06-01').getTime();
    it('derives running, scheduled, ended and inactive', () => {
      expect(statusOf(base, now)).to.equal('running');
      expect(statusOf({ ...base, startDate: new Date('2026-07-01') }, now)).to.equal('scheduled');
      expect(statusOf({ ...base, endDate: new Date('2026-05-01') }, now)).to.equal('ended');
      expect(statusOf({ ...base, status: 'Inactive' }, now)).to.equal('inactive');
    });
  });

  describe('validate', () => {
    const issuesFor = (meta) => validate(readExperiment(meta, '/p'), { audiences: AUDIENCES }).map((i) => `${i.level}:${i.message}`);

    it('passes a well-formed test', () => {
      expect(issuesFor({ experiment: 'x', 'experiment-variants': '/v', 'experiment-split': '50' })).to.deep.equal([]);
    });

    it('flags every silent failure mode', () => {
      const issues = issuesFor({
        experiment: 'x',
        'experiment-variants': '/v1, /v2, /p',
        'experiment-split': '60, 50',
        'experiment-status': 'paused',
        'experiment-start-date': '2026-09-01',
        'experiment-end-date': '2026-08-01',
        'experiment-audience': 'enterprise',
      }).join('\n');
      expect(issues).to.contain('warn:2 split value(s) for 3 variant(s)');
      expect(issues).to.contain('error:Splits add up to more than 100%');
      expect(issues).to.contain('warn:A variant points at the control page itself');
      expect(issues).to.contain('warn:Unknown status "paused"');
      expect(issues).to.contain('error:Start Date is not before End Date');
      expect(issues).to.contain('error:Unknown audience(s) enterprise');
    });

    it('flags missing variants and bad dates', () => {
      const issues = issuesFor({ experiment: 'x', 'experiment-end-date': 'soon' }).join('\n');
      expect(issues).to.contain('error:No variants');
      expect(issues).to.contain('error:End Date is not a valid date');
    });
  });

  describe('matchesPattern', () => {
    it('handles exact paths, ** and * the way bulk metadata patterns are written', () => {
      expect(matchesPattern('/pricing', '/pricing')).to.equal(true);
      expect(matchesPattern('/pricing', '/pricing/teams')).to.equal(false);
      expect(matchesPattern('/features/**', '/features/a/b')).to.equal(true);
      expect(matchesPattern('/features/*', '/features/a/b')).to.equal(false);
      expect(matchesPattern('**/compare', '/de/compare')).to.equal(true);
    });
  });
});
