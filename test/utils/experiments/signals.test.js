import { expect } from '@esm-bundle/chai';
import { hasExperimentSignal } from '../../../scripts/utils/experiments/signals.js';

const soon = ((d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()]
  .map((n) => `${n}`.padStart(2, '0')).join('-'))(new Date(Date.now() + 30 * 864e5));

describe('scripts/utils/experiments/signals.js', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[name^="experiment"],meta[name^="audience"],meta[name^="campaign"],meta[property^="experiment:"],meta[property^="audience:"],meta[property^="campaign:"]').forEach((m) => m.remove());
    document.body.innerHTML = '';
    window.history.replaceState({}, '', window.location.pathname);
  });

  afterEach(() => {
    window.history.replaceState({}, '', window.location.pathname);
  });

  it('is false for a plain page', () => {
    document.body.innerHTML = '<main><div><p>plain</p></div></main>';
    expect(hasExperimentSignal()).to.equal(false);
  });

  it('detects an authored Experiment table before the loader compiles it', () => {
    document.body.innerHTML = `<main>
      <div><h1>Control</h1></div>
      <div><div class="experiment">
        <div><div>Test Name</div><div>Hero Test</div></div>
        <div><div>Variants</div><div><a href="/variants/hero-b">/variants/hero-b</a></div></div>
        <div><div>Split</div><div>50</div></div>
      </div></div>
    </main>`;
    expect(hasExperimentSignal()).to.equal(true);
  });

  it('detects an authored Personalize table before the loader compiles it', () => {
    document.body.innerHTML = `<main><div>
      <h1>Control</h1>
      <div class="personalize">
        <div><div>Name</div><div>Hero</div></div>
        <div><div>Audience: mobile</div><div><a href="/v/mobile">/v/mobile</a></div></div>
        <div><div>End Date</div><div>${soon}</div></div>
      </div>
    </div></main>`;
    expect(hasExperimentSignal()).to.equal(true);
  });

  it('detects plugin head metadata that can run page modifications', () => {
    document.head.insertAdjacentHTML('beforeend', `
      <meta name="experiment" content="Hero Test">
      <meta name="campaign-launch" content="/v/campaign">
      <meta name="audience-mobile" content="/v/mobile">
    `);
    document.body.innerHTML = '<main><div><h1>Control</h1></div></main>';
    expect(hasExperimentSignal()).to.equal(true);
  });

  it('detects plugin property metadata forms', () => {
    document.head.insertAdjacentHTML('beforeend', `
      <meta property="experiment:variants" content="/v/hero">
      <meta property="campaign:launch" content="/v/campaign">
      <meta property="audience:mobile" content="/v/mobile">
    `);
    document.body.innerHTML = '<main><div><h1>Control</h1></div></main>';
    expect(hasExperimentSignal()).to.equal(true);
  });

  it('detects raw plugin Section Metadata rows used by Quick Edit', () => {
    document.body.innerHTML = `<main><div>
      <h1>Control</h1>
      <div class="section-metadata">
        <div><div>Experiment Variants</div><div><a href="/v/exp">/v/exp</a></div></div>
        <div><div>Campaign: launch</div><div><a href="/v/campaign">/v/campaign</a></div></div>
        <div><div>Audience: mobile</div><div><a href="/v/mobile">/v/mobile</a></div></div>
      </div>
    </div></main>`;
    expect(hasExperimentSignal()).to.equal(true);
  });

  it('ignores author preview params when no metadata can be previewed', () => {
    document.body.innerHTML = '<main><div><p>plain</p></div></main>';
    window.history.replaceState({}, '', '?experiment=hero-test/challenger-1');
    expect(hasExperimentSignal()).to.equal(false);
  });

  it('ignores value cells and plural prose keys that the loader will not mutate', () => {
    document.body.innerHTML = `<main><div><p>Hi</p><div class="section-metadata">
      <div><div>Anchor</div><div>Audience Stories</div></div>
      <div><div>Style</div><div>experiment, campaign</div></div>
      <div><div>Audiences</div><div>mobile</div></div>
    </div></div></main>`;
    expect(hasExperimentSignal()).to.equal(false);
  });
});
