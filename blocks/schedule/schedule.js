import { getConfig } from '../../scripts/ak.js';
import ENV from '../../scripts/utils/env.js';
import { loadFragmentWithFallback, getReplaceEl, replaceElWithFragment } from '../../scripts/utils/fragment.js';
import { getScheduleSim } from '../../scripts/scheduler/schedule-sim.js';

const config = getConfig();

const removeSchedule = (a) => {
  if (ENV === 'prod') {
    a.remove();
    return;
  }
  config.log(`Could not load: ${a.href}`);
};

// Locale copy first, root fallback (localeCandidates), like every other
// fragment surface: an untranslated event fragment still renders on locale pages.
const loadLocalizedEvent = async (event) => {
  if (!event?.fragment) return null;
  try {
    return await loadFragmentWithFallback(new URL(event.fragment, window.location.origin).pathname);
  } catch {
    config.log(`Error fetching ${event.fragment} fragment`);
    return null;
  }
};

const loadEvent = async (a, event, defEvent) => {
  if (!event.fragment) {
    a.remove();
    return;
  }
  const fragment = await loadLocalizedEvent(event)
    ?? (event === defEvent ? null : await loadLocalizedEvent(defEvent));
  if (!fragment) {
    removeSchedule(a);
    return;
  }
  const elToReplace = getReplaceEl(a);
  if (!elToReplace) {
    config.log(`Fragment anchor detached: ${a.href}`);
    return;
  }
  replaceElWithFragment(elToReplace, fragment);
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
    // A row with a blank start or end is the default row (picked up as
    // defEvent below), not a scheduled one: skip it silently, before parsing.
    if (!(evt.start && evt.end)) return false;
    // Date.parse returns NaN (it never throws) on a malformed date, and every
    // comparison with NaN is false, so guard NaN explicitly and log only when
    // an authored date is present but unparseable.
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
