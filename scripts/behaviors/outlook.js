import { track } from '../utils/analytics.js';

// Outlook widget: choose desktop deeplink vs mailto at click time.
// Link carries ?to=…&subject=…&body=… ; desktop deeplink used on wide viewports.
const buildMailto = (params) => {
  const to = params.get('to') ?? '';
  const search = new URLSearchParams();
  if (params.get('subject')) search.set('subject', params.get('subject'));
  if (params.get('body')) search.set('body', params.get('body'));
  const qs = search.toString();
  return `mailto:${to}${qs ? `?${qs}` : ''}`;
};

const buildDeeplink = (params) => {
  const search = new URLSearchParams({ path: '/mail/action/compose' });
  if (params.get('to')) search.set('to', params.get('to'));
  if (params.get('subject')) search.set('subject', params.get('subject'));
  if (params.get('body')) search.set('body', params.get('body'));
  return `ms-outlook://compose?${search.toString()}`;
};

export default (a) => {
  if (a.dataset.behaviorBound) return;
  a.dataset.behaviorBound = '';
  const params = new URL(a.href, window.location.href).searchParams;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const desktop = window.matchMedia('(width >= 768px)').matches;
    const href = desktop ? buildDeeplink(params) : buildMailto(params);
    track('outlook_compose', { desktop, to: params.get('to') });
    window.location.href = href;
  });
};
