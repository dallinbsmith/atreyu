import { expect } from '@esm-bundle/chai';

const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';
const SCROLL_TRIGGER_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js';

const scriptFor = (src) => [...document.scripts].find((script) => script.getAttribute('src') === src);
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('gsap-loader', () => {
  const originalMatchMedia = window.matchMedia;
  const hardware = Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency')
    ?? Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');

  beforeEach(() => {
    window.matchMedia = () => ({ matches: false, addEventListener: () => {} });
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
    window.gsap = undefined;
    window.ScrollTrigger = undefined;
    document.head.querySelectorAll('script[src^="https://cdn.jsdelivr.net/npm/gsap@"]').forEach((script) => script.remove());
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    if (hardware) Object.defineProperty(navigator, 'hardwareConcurrency', hardware);
    window.gsap = undefined;
    window.ScrollTrigger = undefined;
    document.head.querySelectorAll('script[src^="https://cdn.jsdelivr.net/npm/gsap@"]').forEach((script) => script.remove());
  });

  it('loads pinned GSAP URLs with SRI and crossorigin attributes', async () => {
    const { loadGsap } = await import('../../../scripts/utils/motion/gsap-loader.js');

    const pending = loadGsap();
    await Promise.resolve();

    const gsapScript = scriptFor(GSAP_URL);
    expect(Boolean(gsapScript)).to.equal(true);
    expect(gsapScript.getAttribute('integrity'))
      .to.equal('sha384-HOvlOYPIs/zjoIkWUGXkVmXsjr8GuZLV+Q+rcPwmJOVZVpvTSXQChiN4t9Euv9Vc');
    expect(gsapScript.getAttribute('crossorigin')).to.equal('anonymous');

    const registered = [];
    window.gsap = { registerPlugin: (plugin) => registered.push(plugin) };
    gsapScript.dispatchEvent(new Event('load'));
    await flush();

    const scrollTriggerScript = scriptFor(SCROLL_TRIGGER_URL);
    expect(Boolean(scrollTriggerScript)).to.equal(true);
    expect(scrollTriggerScript.getAttribute('integrity'))
      .to.equal('sha384-P8VzCVnT9NBUkMrpcIZrJbA7EBjJvh/fJS6PmP+4nLIM284DtsImIv8D0fFjIkeh');
    expect(scrollTriggerScript.getAttribute('crossorigin')).to.equal('anonymous');

    window.ScrollTrigger = { name: 'ScrollTrigger' };
    scrollTriggerScript.dispatchEvent(new Event('load'));

    expect(await pending).to.deep.equal({ gsap: window.gsap, ScrollTrigger: window.ScrollTrigger });
    expect(registered).to.deep.equal([window.ScrollTrigger]);
  });
});
