import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';

// schedule.js caches getConfig() at module load, so setConfig (with a log
// spy) must run before the block module is imported.
const logs = [];
setConfig({
  components: [], hostnames: [], linkBlocks: [], locales: { '': {} }, log: (msg) => logs.push(msg),
});
const { default: decorate } = await import('../../blocks/schedule/schedule.js');

const stubFetch = (data) => {
  const original = window.fetch;
  window.fetch = async () => new Response(JSON.stringify({ data }), { status: 200 });
  return () => { window.fetch = original; };
};

const scheduleLink = () => {
  const a = document.createElement('a');
  a.href = '/schedules/test.json';
  document.body.append(a);
  return a;
};

const eventLogs = () => logs.filter((msg) => String(msg).startsWith('Could not get scheduled event'));

// The default row carries no fragment here, so decorate() ends in a.remove()
// without fetching anything further: the only fetch is the schedule JSON.
const defaultRow = {
  name: 'default', start: '', end: '', fragment: '',
};

describe('schedule', () => {
  let restoreFetch;
  let a;
  beforeEach(() => {
    logs.length = 0;
    localStorage.removeItem('aem-schedule');
  });
  afterEach(() => {
    restoreFetch?.();
    a?.remove();
  });

  it('does not log for the default row, which has no start or end by design', async () => {
    restoreFetch = stubFetch([defaultRow]);
    a = scheduleLink();
    await decorate(a);
    expect(eventLogs()).to.deep.equal([]);
  });

  it('skips a row with only one of start/end silently', async () => {
    restoreFetch = stubFetch([
      defaultRow,
      {
        name: 'half', start: '2020-01-01T00:00:00Z', end: '', fragment: '',
      },
    ]);
    a = scheduleLink();
    await decorate(a);
    expect(eventLogs()).to.deep.equal([]);
  });

  it('logs once when a date is present but invalid', async () => {
    restoreFetch = stubFetch([
      defaultRow,
      {
        name: 'broken', start: 'not a date', end: '2999-01-01T00:00:00Z', fragment: '',
      },
    ]);
    a = scheduleLink();
    await decorate(a);
    expect(eventLogs()).to.deep.equal(['Could not get scheduled event: broken']);
  });
});
