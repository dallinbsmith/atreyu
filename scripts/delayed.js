// Third-party scripts: analytics, consent, chat, tag managers.
// Loaded 3s+ after LCP — nothing here may block INP.

import { setAnalyticsProvider } from './utils/analytics/analytics.js';
import { hasConsent, onConsentChange } from './utils/analytics/consent.js';
import { loadSegment } from './utils/analytics/segment.js';
import { runBehaviors } from './behaviors.js';

runBehaviors('delayed');

const loadAnalytics = () => {
  if (hasConsent('analytics')) {
    loadSegment();
    setAnalyticsProvider((event, props) => {
      window.analytics?.track(event, props);
    });
  }
};

// Re-check when consent changes
onConsentChange(({ detail }) => {
  if (detail.analytics) loadAnalytics();
});

loadAnalytics();
