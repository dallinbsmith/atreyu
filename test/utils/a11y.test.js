import { expect } from '@esm-bundle/chai';
import { generateId, rovingTabindex, trapFocus, announce } from '../../scripts/utils/a11y.js';

describe('a11y utilities', () => {
  describe('generateId', () => {
    it('returns an ID with the correct prefix format', () => {
      const id = generateId('test');
      expect(id).to.match(/^test-\d+$/);
    });

    it('returns unique IDs that increment and never collide', () => {
      const ids = Array.from({ length: 5 }, () => generateId('uid'));
      const unique = new Set(ids);
      expect(unique.size).to.equal(5);

      const numbers = ids.map((id) => Number(id.split('-').at(-1)));
      for (let i = 1; i < numbers.length; i += 1) {
        expect(numbers[i]).to.be.greaterThan(numbers[i - 1]);
      }
    });

    it('uses default prefix when none is provided', () => {
      const id = generateId();
      expect(id).to.match(/^a11y-\d+$/);
    });
  });

  describe('rovingTabindex', () => {
    let container;
    let items;

    beforeEach(() => {
      container = document.createElement('div');
      items = Array.from({ length: 3 }, () => {
        const btn = document.createElement('button');
        btn.textContent = 'item';
        container.append(btn);
        return btn;
      });
      document.body.append(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('sets first item to tabindex="0" and rest to "-1"', () => {
      rovingTabindex(container, items);
      expect(items[0].getAttribute('tabindex')).to.equal('0');
      expect(items[1].getAttribute('tabindex')).to.equal('-1');
      expect(items[2].getAttribute('tabindex')).to.equal('-1');
    });

    it('cleanup function removes the event listener without errors', () => {
      const cleanup = rovingTabindex(container, items);
      cleanup();

      // Dispatching keydown after cleanup should not change tabindex state
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      container.dispatchEvent(event);

      // First item should still be active (no navigation happened after cleanup)
      expect(items[0].getAttribute('tabindex')).to.equal('0');
    });
  });

  describe('trapFocus', () => {
    let wrapper;
    let container;
    let sibling1;
    let sibling2;

    beforeEach(() => {
      wrapper = document.createElement('div');
      sibling1 = document.createElement('div');
      sibling1.textContent = 'sibling 1';
      container = document.createElement('div');
      container.innerHTML = '<button>first</button><button>last</button>';
      sibling2 = document.createElement('div');
      sibling2.textContent = 'sibling 2';
      wrapper.append(sibling1, container, sibling2);
      document.body.append(wrapper);
    });

    afterEach(() => {
      wrapper.remove();
    });

    it('sets inert on sibling elements', () => {
      trapFocus(container);
      expect(sibling1.hasAttribute('inert')).to.be.true;
      expect(sibling2.hasAttribute('inert')).to.be.true;
      expect(container.hasAttribute('inert')).to.be.false;
    });

    it('cleanup removes inert attributes', () => {
      const cleanup = trapFocus(container);
      expect(sibling1.hasAttribute('inert')).to.be.true;

      cleanup();
      expect(sibling1.hasAttribute('inert')).to.be.false;
      expect(sibling2.hasAttribute('inert')).to.be.false;
    });
  });

  describe('announce', () => {
    // announce() uses a module-level singleton for the live region.
    // We must not remove it between tests — doing so leaves the module
    // reference pointing at a detached node, breaking subsequent calls.

    it('creates a live region element in the DOM', () => {
      announce('hello');
      const region = document.querySelector('[aria-live]');
      expect(region).to.not.be.null;
      expect(region.parentElement).to.equal(document.body);
    });

    it('sets aria-live to polite by default', () => {
      announce('polite message');
      const region = document.querySelector('[aria-live]');
      expect(region.getAttribute('aria-live')).to.equal('polite');
      expect(region.getAttribute('role')).to.equal('status');
    });

    it('sets aria-live to assertive when specified', () => {
      announce('urgent message', 'assertive');
      const region = document.querySelector('[aria-live]');
      expect(region.getAttribute('aria-live')).to.equal('assertive');
      expect(region.getAttribute('role')).to.equal('alert');
    });

    it('sets the message text after a short delay', async () => {
      announce('delayed text');
      const region = document.querySelector('[aria-live]');
      // Text is cleared immediately, then set via setTimeout
      expect(region.textContent).to.equal('');

      await new Promise((resolve) => { setTimeout(resolve, 150); });
      expect(region.textContent).to.equal('delayed text');
    });
  });
});
