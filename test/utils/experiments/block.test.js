import { expect } from '@esm-bundle/chai';
import { metaName, applyExperimentBlock } from '../../../scripts/utils/experiments/block.js';
import { readExperiment } from '../../../scripts/utils/experiments/config.js';

const TABLE = `<div class="experiment">
  <div><div>Test Name</div><div>C2C Headline</div></div>
  <div><div>Variants</div><div><p><a href="https://main--atreyu--dallinbsmith.aem.page/experiments/a">a</a></p><p><a href="/experiments/b">b</a></p></div></div>
  <div><div>Variant Names</div><div>Short, Long</div></div>
  <div><div>Split</div><div>30, 30</div></div>
  <div><div>Audience</div><div>mobile</div></div>
  <div><div>Start Date</div><div></div></div>
  <div><div>Status</div><div>active</div></div>
</div>`;

const headMeta = () => Object.fromEntries([...document.head.querySelectorAll('meta[name^="experiment"]')]
  .map((m) => [m.name, m.content]));

describe('scripts/utils/experiments/block.js', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[name^="experiment"]').forEach((m) => m.remove());
    document.body.innerHTML = '';
  });

  it('maps friendly and plugin-style row labels to plugin metadata keys', () => {
    expect(['Test Name', 'Name', 'Experiment', 'ID'].map(metaName)).to.deep.equal(Array(4).fill('experiment'));
    expect(metaName('Split')).to.equal('experiment-split');
    expect(metaName('Experiment Split')).to.equal('experiment-split');
    expect(metaName('Variant Names')).to.equal('experiment-variant-names');
    expect(metaName('Start Date')).to.equal('experiment-start-date');
    expect(metaName('  ')).to.equal(null);
  });

  it('writes the table as head metadata, skips empty rows, and removes the table and its section', () => {
    document.body.innerHTML = `<main><div><h1>Hero</h1></div><div>${TABLE}<div class="section-metadata"></div></div></main>`;
    applyExperimentBlock();
    expect(headMeta()).to.deep.equal({
      experiment: 'C2C Headline',
      'experiment-variants': 'https://main--atreyu--dallinbsmith.aem.page/experiments/a, /experiments/b',
      'experiment-variant-names': 'Short, Long',
      'experiment-split': '30, 30',
      'experiment-audience': 'mobile',
      'experiment-status': 'active',
    });
    expect(document.querySelector('.experiment')).to.equal(null);
    expect(document.querySelectorAll('main > div').length).to.equal(1);
  });

  it('parses to the same config the plugin would read from page metadata', () => {
    document.body.innerHTML = `<main><div>${TABLE}</div></main>`;
    const cfg = readExperiment(applyExperimentBlock(), '/features/c2c');
    expect(cfg.id).to.equal('c2c-headline');
    expect(cfg.audiences).to.deep.equal(['mobile']);
    expect(cfg.variants.map((v) => [v.label, v.path, v.split])).to.deep.equal([
      ['Control', '/features/c2c', 40], ['Short', '/experiments/a', 30], ['Long', '/experiments/b', 30],
    ]);
  });

  it('replaces existing experiment metadata and keeps sections with other content', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="experiment" content="Old"><meta name="experiment-split" content="90">');
    document.body.innerHTML = `<main><div><p>Keep me</p>${TABLE}${TABLE}</div></main>`;
    applyExperimentBlock();
    expect(headMeta().experiment).to.equal('C2C Headline');
    expect(headMeta()['experiment-split']).to.equal('30, 30');
    expect(document.querySelectorAll('.experiment').length).to.equal(0);
    expect(document.querySelector('main > div p').textContent).to.equal('Keep me');
  });

  it('removes a table without a test name but leaves page metadata alone', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="experiment" content="From Metadata">');
    document.body.innerHTML = '<main><div><div class="experiment"><div><div>Split</div><div>50</div></div></div></div></main>';
    expect(applyExperimentBlock()).to.equal(null);
    expect(headMeta()).to.deep.equal({ experiment: 'From Metadata' });
    expect(document.querySelector('.experiment')).to.equal(null);
  });

  it('does nothing on a page without the table', () => {
    document.body.innerHTML = '<main><div><p>x</p></div></main>';
    expect(applyExperimentBlock()).to.equal(null);
    expect(document.querySelectorAll('main > div').length).to.equal(1);
  });
});
