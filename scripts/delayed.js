// Third-party scripts: analytics, consent, chat, tag managers.
// Loaded 3s+ after LCP — nothing here may block INP.

import { setAnalyticsProvider } from './utils/analytics.js';
import { hasConsent, onConsentChange } from './utils/consent.js';

const loadAnalytics = () => {
  if (hasConsent('analytics')) {
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
