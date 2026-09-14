import { expect } from '@esm-bundle/chai';
import { listenGroup } from '../../scripts/utils/listen.js';

describe('listenGroup', () => {
  it('fires a listener until end() drops the whole group', () => {
    const el = document.createElement('button');
    document.body.append(el);
    const group = listenGroup();
    let count = 0;
    group.listen(el, 'click', () => { count += 1; });

    el.click();
    expect(count).to.equal(1);

    group.end();
    el.click();
    expect(count).to.equal(1);
    el.remove();
  });

  it('end() drops every listener in the group, not just the last', () => {
    const a = document.createElement('button');
    const b = document.createElement('button');
    document.body.append(a, b);
    const group = listenGroup();
    const seen = [];
    group.listen(a, 'click', () => { seen.push('a'); });
    group.listen(b, 'click', () => { seen.push('b'); });

    a.click();
    b.click();
    group.end();
    a.click();
    b.click();

    expect(seen).to.deep.equal(['a', 'b']);
    a.remove();
    b.remove();
  });
});
