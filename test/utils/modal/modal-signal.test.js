import { expect } from '@esm-bundle/chai';
import { openModal, wireModalClose } from '../../../scripts/utils/modal/modal.js';

describe('modal signal teardown', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('removes a body-appended modal and releases focus trap on abort', () => {
    const sibling = document.createElement('main');
    const modal = document.createElement('div');
    const backdrop = document.createElement('div');
    const close = document.createElement('button');
    close.className = 'modal-close';
    modal.append(backdrop, close);
    document.body.append(sibling);
    const controller = new AbortController();

    wireModalClose(modal, backdrop, () => {}, { signal: controller.signal });
    openModal(modal, '.modal-close', { signal: controller.signal });
    expect(document.body.contains(modal)).to.be.true;
    expect(document.body.style.overflow).to.equal('hidden');
    expect(sibling.hasAttribute('inert')).to.be.true;

    controller.abort();
    expect(document.body.contains(modal)).to.be.false;
    expect(document.body.style.overflow).to.equal('');
    expect(sibling.hasAttribute('inert')).to.be.false;
  });
});
