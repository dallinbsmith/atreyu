import { expect } from '@esm-bundle/chai';
import { classifyEnv } from '../../../scripts/utils/env.js';
import {
  isAuthoringPreviewAllowed,
  resolvePreviewOrigin,
} from '../../../scripts/utils/security/preview-origin.js';

describe('preview-origin security gates', () => {
  const setDeployTier = (content) => {
    document.head.querySelector('meta[name="deploy-tier"]')?.remove();
    if (!content) return;
    const meta = document.createElement('meta');
    meta.name = 'deploy-tier';
    meta.content = content;
    document.head.append(meta);
  };

  afterEach(() => {
    setDeployTier('');
  });

  it('classifies production hosts as prod', () => {
    expect(classifyEnv('frame.io')).to.equal('prod');
    expect(classifyEnv('www.frame.io')).to.equal('prod');
  });

  it('classifies AEM page/live branch hosts as stage', () => {
    expect(classifyEnv('main--atreyu--dallinbsmith.aem.live')).to.equal('stage');
    expect(classifyEnv('feature--atreyu--dallinbsmith.aem.page')).to.equal('stage');
  });

  it('ignores forged deploy-tier meta on AEM page/live hosts', () => {
    setDeployTier('prod');
    expect(classifyEnv('main--atreyu--dallinbsmith.aem.live')).to.equal('stage');
    expect(classifyEnv('feature--atreyu--dallinbsmith.aem.page')).to.equal('stage');
  });

  it('classifies localhost as dev', () => {
    expect(classifyEnv('localhost:3000')).to.equal('dev');
    expect(classifyEnv('127.0.0.1:3000')).to.equal('dev');
  });

  it('uses valid deploy-tier meta on custom hosts', () => {
    for (const tier of ['stage', 'dev', 'prod']) {
      setDeployTier(tier);
      expect(classifyEnv('stage.frame.io')).to.equal(tier);
    }
  });

  it('fails closed to prod on custom hosts with missing or invalid deploy-tier meta', () => {
    expect(classifyEnv('stage.frame.io')).to.equal('prod');
    setDeployTier('preview');
    expect(classifyEnv('stage.frame.io')).to.equal('prod');
  });

  it('fails closed to prod when document is unavailable', () => {
    expect(classifyEnv('stage.frame.io', null)).to.equal('prod');
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
