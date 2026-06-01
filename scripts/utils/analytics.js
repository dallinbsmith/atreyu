const queue = [];
let provider;

const enrich = (properties) => ({
  timestamp: new Date().toISOString(),
  url: window.location.href,
  locale: document.documentElement.lang || 'en',
  ...properties,
});

export const track = (event, properties = {}) => {
  const enriched = enrich(properties);
  if (provider) provider(event, enriched);
  else queue.push([event, enriched]);
};

export const setAnalyticsProvider = (fn) => {
  provider = fn;
  while (queue.length) provider(...queue.shift());
};
