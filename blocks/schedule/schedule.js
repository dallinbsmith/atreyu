import { getConfig, localizeUrl } from '../../scripts/ak.js';
import ENV from '../../scripts/utils/env.js';
import { loadFragment, getReplaceEl, replaceElWithFragment } from '../../scripts/utils/fragment.js';
import { getScheduleSim } from '../../scripts/scheduler/schedule-sim.js';

const config = getConfig();

const removeSchedule = (a) => {
  if (ENV === 'prod') {
    a.remove();
    return;
  }
  config.log(`Could not load: ${a.href}`);
};

const loadLocalizedEvent = async (event) => {
  const url = new URL(event.fragment);
  const localized = localizeUrl({ config, url });
  const path = localized?.pathname || url.pathname;
  try {
    return await loadFragment(path);
  } catch {
    config.log(`Error fetching ${path} fragment`);
    return null;
  }
};

const loadEvent = async (a, event, defEvent) => {
  if (!event.fragment) {
    a.remove();
    return;
  }
  const fragment = await loadLocalizedEvent(event) ?? await loadLocalizedEvent(defEvent);
  if (!fragment) {
    removeSchedule(a);
    return;
  }
  replaceElWithFragment(getReplaceEl(a), fragment);
};

export default async (a) => {
  const resp = await fetch(a.href);
  if (!resp.ok) {
    removeSchedule(a);
    return;
  }
  const { data } = await resp.json();
  data.reverse();

  const now = getScheduleSim() ?? Date.now();
  const found = data.find((evt) => {
    // Date.parse returns NaN (it never throws) on a malformed/missing date, and
    // every comparison with NaN is false — so guard NaN explicitly instead of
    // relying on a try/catch that could never fire.
    const start = Date.parse(evt.start);
    const end = Date.parse(evt.end);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      config.log(`Could not get scheduled event: ${evt.name}`);
      return false;
    }
    return now > start && now < end;
  });
  const defEvent = data.find((evt) => !(evt.start && evt.end));
  const event = found || defEvent;
  if (!event) {
    removeSchedule(a);
    return;
  }
  await loadEvent(a, event, defEvent);
};
