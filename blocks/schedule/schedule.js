import { getConfig, localizeUrl } from '../../scripts/ak.js';
import ENV from '../../scripts/utils/env.js';
import { loadFragment, getReplaceEl } from '../../scripts/utils/fragment.js';

const config = getConfig();

const removeSchedule = async (a, e) => {
  if (ENV === 'prod') {
    a.remove();
    return;
  }
  if (e) config.log(e);
  config.log(`Could not load: ${a.href}`);
};

const loadLocalizedEvent = async (event) => {
  const url = new URL(event.fragment);
  const localized = localizeUrl({ config, url });
  const path = localized?.pathname || url.pathname;

  try {
    const fragment = await loadFragment(path);
    return fragment;
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

  let fragment = await loadLocalizedEvent(event);
  if (!fragment) fragment = await loadLocalizedEvent(defEvent);
  if (!fragment) {
    removeSchedule(a);
    return;
  }
  const elToReplace = getReplaceEl(a);
  const sections = fragment.querySelectorAll(':scope > .section');
  const children = sections.length === 1
    ? fragment.querySelectorAll(':scope > *')
    : [fragment];
  for (const child of children) {
    elToReplace.insertAdjacentElement('afterend', child);
  }
  elToReplace.remove();
};

const getDate = () => {
  const now = Date.now();
  if (ENV === 'prod') return now;

  const sim = localStorage.getItem('aem-schedule')
   || new URL(window.location.href).searchParams.get('schedule');
  return sim * 1000 || now;
};

export default async (a) => {
  const resp = await fetch(a.href);
  if (!resp.ok) {
    await removeSchedule(a);
    return;
  }
  const { data } = await resp.json();
  data.reverse();
  const now = getDate();
  const found = data.find((evt) => {
    try {
      const start = Date.parse(evt.start);
      const end = Date.parse(evt.end);
      return now > start && now < end;
    } catch {
      config.log(`Could not get scheduled event: ${evt.name}`);
      return false;
    }
  });

  const defEvent = data.find((evt) => !(evt.start && evt.end));

  const event = found || defEvent;
  if (!event) {
    await removeSchedule(a);
    return;
  }

  await loadEvent(a, event, defEvent);
};
