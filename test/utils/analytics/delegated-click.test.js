import { expect } from '@esm-bundle/chai';
import { setAnalyticsProvider, EVENTS } from '../../../scripts/utils/analytics/analytics.js';
import { setConsent, resetConsent } from '../../../scripts/utils/analytics/consent.js';
import '../../../scripts/utils/analytics/delegated-click.js';

describe('utils/analytics/delegated-click', () => {
  let calls;

  before(() => {
    setConsent({ analytics: true });
    calls = [];
    setAnalyticsProvider((event, props) => calls.push([event, props]));
  });

  after(() => {
    resetConsent();
  });

  beforeEach(() => {
    calls.length = 0;
  });

  it('fires track() with the element\'s data-track-event on click', () => {
    const el = document.createElement('button');
    el.dataset.trackEvent = EVENTS.DOWNLOAD;
    document.body.append(el);
    el.click();
    expect(calls).to.have.length(1);
    expect(calls[0][0]).to.equal(EVENTS.DOWNLOAD);
  });

  it('parses data-track-props JSON and includes it in the event payload', () => {
    const el = document.createElement('button');
    el.dataset.trackEvent = EVENTS.DOWNLOAD;
    el.dataset.trackProps = JSON.stringify({ os: 'mac' });
    document.body.append(el);
    el.click();
    expect(calls[0][1].os).to.equal('mac');
  });

  it('includes the nearest data-testid as a property, if present', () => {
    const wrapper = document.createElement('div');
    wrapper.dataset.testid = 'hero-cta-primary';
    const el = document.createElement('button');
    el.dataset.trackEvent = EVENTS.DOWNLOAD;
    wrapper.append(el);
    document.body.append(wrapper);
    el.click();
    expect(calls[0][1].testid).to.equal('hero-cta-primary');
  });

  it('does nothing for a click with no data-track-event ancestor', () => {
    const el = document.createElement('button');
    document.body.append(el);
    el.click();
    expect(calls).to.have.length(0);
  });

  it('does not throw on malformed data-track-props JSON, and still fires the event', () => {
    const el = document.createElement('button');
    el.dataset.trackEvent = EVENTS.DOWNLOAD;
    el.dataset.trackProps = '{not valid json';
    document.body.append(el);
    expect(() => el.click()).to.not.throw();
    expect(calls).to.have.length(1);
  });
});
