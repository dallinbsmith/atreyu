import { expect } from '@esm-bundle/chai';
import auditTestids from '../../../scripts/utils/analytics/testid-audit.js';

describe('utils/analytics/testid-audit', () => {
  let warnCalls;
  let originalWarn;

  beforeEach(() => {
    warnCalls = [];
    originalWarn = console.warn;
    // eslint-disable-next-line no-console -- capturing the warning IS the test
    console.warn = (...args) => warnCalls.push(args);
  });

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.warn = originalWarn;
    document.querySelectorAll('.btn').forEach((el) => el.remove());
  });

  it('warns when a .btn element is missing data-testid', () => {
    const a = document.createElement('a');
    a.className = 'btn';
    document.body.append(a);
    auditTestids();
    expect(warnCalls).to.have.length(1);
  });

  it('does not warn when every .btn element has data-testid', () => {
    const a = document.createElement('a');
    a.className = 'btn';
    a.dataset.testid = 'hero-cta-primary';
    document.body.append(a);
    auditTestids();
    expect(warnCalls).to.have.length(0);
  });

  it('does nothing when there are no .btn elements at all', () => {
    expect(() => auditTestids()).to.not.throw();
    expect(warnCalls).to.have.length(0);
  });
});
