import { expect } from '@esm-bundle/chai';
import { classifyEnv } from '../../../scripts/utils/env.js';
import {
  isAuthoringPreviewAllowed,
  resolvePreviewOrigin,
} from '../../../scripts/utils/security/preview-origin.js';

describe('preview-origin security gates', () => {
  it('classifies production hosts as prod', () => {
    expect(classifyEnv('frame.io')).to.equal('prod');
    expect(classifyEnv('www.frame.io')).to.equal('prod');
    expect(classifyEnv('notlocalhost.example')).to.equal('prod');
    expect(classifyEnv('localhost.attacker.net')).to.equal('prod');
    expect(classifyEnv('main--atreyu--dallinbsmith.hlx.page')).to.equal('prod');
    expect(classifyEnv('feature--atreyu--dallinbsmith.aem.reviews')).to.equal('prod');
    expect(classifyEnv('main--atreyu--dallinbsmith.local')).to.equal('prod');
  });

  it('classifies AEM page/live branch hosts as stage', () => {
    expect(classifyEnv('main--atreyu--dallinbsmith.aem.live')).to.equal('stage');
    expect(classifyEnv('feature--atreyu--dallinbsmith.aem.page')).to.equal('stage');
  });

  it('ignores forged deploy-tier meta', () => {
    const meta = document.createElement('meta');
    meta.name = 'deploy-tier';
    meta.content = 'dev';
    document.head.append(meta);
    try {
      expect(classifyEnv('main--atreyu--dallinbsmith.aem.live')).to.equal('stage');
      expect(classifyEnv('feature--atreyu--dallinbsmith.aem.page')).to.equal('stage');
      expect(classifyEnv('stage.frame.io')).to.equal('prod');
    } finally {
      meta.remove();
    }
  });

  describe('Worker-set data-deploy-tier', () => {
    const html = document.documentElement;
    const meta = document.createElement('meta');
    meta.name = 'deploy-tier';
    afterEach(() => {
      delete html.dataset.deployTier;
      meta.remove();
    });

    it('is honoured on a custom host', () => {
      for (const tier of ['dev', 'stage', 'prod']) {
        html.dataset.deployTier = tier;
        expect(classifyEnv('stage.frame.io')).to.equal(tier);
        expect(classifyEnv('ak-website-staging.example.workers.dev')).to.equal(tier);
      }
    });

    it('reads the root element passed in', () => {
      const root = document.createElement('html');
      root.dataset.deployTier = 'stage';
      expect(classifyEnv('stage.frame.io', root)).to.equal('stage');
      expect(classifyEnv('stage.frame.io', null)).to.equal('prod');
    });

    it('falls back to prod when invalid or missing', () => {
      for (const bad of ['', 'staging', 'STAGE', 'qa', ' dev', 'production']) {
        html.dataset.deployTier = bad;
        expect(classifyEnv('stage.frame.io'), bad).to.equal('prod');
      }
      delete html.dataset.deployTier;
      expect(classifyEnv('stage.frame.io')).to.equal('prod');
      expect(classifyEnv('frame.io')).to.equal('prod');
    });

    it('is ignored on EDS hosts and loopback', () => {
      html.dataset.deployTier = 'prod';
      expect(classifyEnv('main--atreyu--dallinbsmith.aem.live')).to.equal('stage');
      expect(classifyEnv('feature--atreyu--dallinbsmith.aem.page')).to.equal('stage');
      expect(classifyEnv('localhost:3000')).to.equal('dev');
      expect(classifyEnv('127.0.0.1:8787')).to.equal('dev');
      html.dataset.deployTier = 'dev';
      expect(classifyEnv('main--atreyu--dallinbsmith.aem.live')).to.equal('stage');
    });

    it('never honours a deploy-tier meta, on any host', () => {
      for (const tier of ['dev', 'stage']) {
        meta.content = tier;
        document.head.append(meta);
        expect(classifyEnv('frame.io')).to.equal('prod');
        expect(classifyEnv('stage.frame.io')).to.equal('prod');
        expect(classifyEnv('main--atreyu--dallinbsmith.aem.live')).to.equal('stage');
        expect(classifyEnv('localhost:3000')).to.equal('dev');
      }
      meta.content = 'dev';
      html.dataset.deployTier = 'prod';
      expect(classifyEnv('stage.frame.io')).to.equal('prod');
    });
  });

  it('classifies loopback as dev', () => {
    expect(classifyEnv('localhost:3000')).to.equal('dev');
    expect(classifyEnv('LOCALHOST:3000')).to.equal('dev');
    expect(classifyEnv('127.0.0.1:3000')).to.equal('dev');
    expect(classifyEnv('[::1]:3000')).to.equal('dev');
  });

  it('gates authoring imports on prod but allows page/live/local environments', () => {
    expect(isAuthoringPreviewAllowed('frame.io')).to.equal(false);
    expect(isAuthoringPreviewAllowed('www.frame.io')).to.equal(false);
    expect(isAuthoringPreviewAllowed('localization.frame.io')).to.equal(false);
    expect(isAuthoringPreviewAllowed('preview--site.frame.io')).to.equal(false);
    expect(isAuthoringPreviewAllowed('demo-local.example.workers.dev')).to.equal(false);
    expect(isAuthoringPreviewAllowed('main--atreyu--dallinbsmith.aem.live')).to.equal(true);
    expect(isAuthoringPreviewAllowed('feature--atreyu--dallinbsmith.aem.page')).to.equal(true);
    expect(isAuthoringPreviewAllowed('localhost')).to.equal(true);
    expect(isAuthoringPreviewAllowed('localhost:3000')).to.equal(true);
    expect(isAuthoringPreviewAllowed('127.0.0.1:3000')).to.equal(true);
    expect(isAuthoringPreviewAllowed('[::1]:3000')).to.equal(true);
  });

  it('resolves only trusted preview origins', () => {
    const opts = {
      onOrigin: 'https://da.live',
      localOrigin: 'http://localhost:3000',
      branchHost: 'da-live--adobe.aem.live',
    };
    expect(resolvePreviewOrigin('on', opts)).to.equal('https://da.live');
    expect(resolvePreviewOrigin('local', opts)).to.equal('http://localhost:3000');
    expect(resolvePreviewOrigin('feature-1', opts)).to.equal('https://feature-1--da-live--adobe.aem.live');
    expect(resolvePreviewOrigin('evil.com/x', opts)).to.equal(null);
  });
});
