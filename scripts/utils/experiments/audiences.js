// Ordered audience catalog shared by experiment-loader.js (runtime) and the
// experiments panel (validation). Catalog order affects authoring display, the
// generated audience map order, RUM target strings, and data-audiences output.
// Serving precedence still comes from the page's authored audience row order.
import { toClassName } from './config.js';

const CAMPAIGN_SLOT = 'campaign-*';

const viewport = (query) => () => window.matchMedia(query).matches;

export const CATALOG = Object.freeze([
  Object.freeze({
    id: 'mobile',
    label: 'Mobile',
    description: 'Viewport narrower than 768px.',
    consent: 'contextual',
    test: viewport('(width < 768px)'),
  }),
  Object.freeze({
    id: 'desktop',
    label: 'Desktop',
    description: 'Viewport 768px or wider.',
    consent: 'contextual',
    test: viewport('(width >= 768px)'),
  }),
  Object.freeze({
    id: CAMPAIGN_SLOT,
    label: 'Campaign audiences',
    description: 'Placeholder where UTM campaign audiences are inserted.',
    consent: 'contextual',
  }),
]);

const campaignId = (id) => {
  const normalized = toClassName(id);
  if (!normalized) return '';
  return normalized.startsWith('campaign-') ? normalized : `campaign-${normalized}`;
};

const currentCampaignId = () => {
  const params = new URLSearchParams(window.location.search);
  const campaign = params.get('utm_campaign') || params.get('campaign');
  return campaign ? campaignId(campaign) : '';
};

const campaignEntry = (id) => {
  const normalized = campaignId(id);
  if (!normalized) return null;
  return {
    id: normalized,
    label: normalized.replace(/^campaign-/, 'Campaign '),
    description: `Visitor arrived with ${normalized} campaign attribution.`,
    consent: 'contextual',
    test: () => currentCampaignId() === normalized,
  };
};

export const materializeCatalog = (
  campaignIds = [],
  catalog = CATALOG,
) => catalog.flatMap((entry) => (entry.id === CAMPAIGN_SLOT
  ? (campaignIds ?? []).map(campaignEntry).filter(Boolean)
  : [entry]));

const resolveAll = async (ids, audiences) => {
  if (!ids.length) return false;
  const results = await Promise.all(ids.map(async (id) => {
    try {
      return await audiences[id]();
    } catch (ex) {
      // eslint-disable-next-line no-console -- author-facing diagnostics
      console.warn(`Audience "${id}" failed while resolving a composite audience.`, ex);
      return false;
    }
  }));
  return results.every(Boolean);
};

const validateEntry = (entry, byId) => {
  if (entry.all && !Array.isArray(entry.all)) throw new Error(`Audience "${entry.id}" all must be an array.`);
  if (entry.all && entry.test) throw new Error(`Audience "${entry.id}" cannot define both all and test.`);
  for (const part of entry.all ?? []) {
    if (part === entry.id) throw new Error(`Audience "${entry.id}" cannot reference itself.`);
    if (!byId.has(part)) throw new Error(`Audience "${entry.id}" references unknown audience "${part}".`);
  }
};

const validateCatalog = (catalog) => {
  const entries = catalog.filter(({ id }) => id !== CAMPAIGN_SLOT);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) validateEntry(entry, byId);
  const visit = (id, stack = []) => {
    if (stack.includes(id)) throw new Error(`Audience cycle detected: ${[...stack, id].join(' -> ')}.`);
    for (const part of byId.get(id)?.all ?? []) visit(part, [...stack, id]);
  };
  for (const { id } of entries) visit(id);
};

export const toAudienceMap = (catalog = CATALOG) => {
  validateCatalog(catalog);
  const audiences = {};
  for (const entry of catalog.filter(({ id }) => id !== CAMPAIGN_SLOT)) {
    audiences[entry.id] = entry.all
      ? () => resolveAll(entry.all, audiences)
      : entry.test;
  }
  return audiences;
};

export const AUDIENCES = Object.freeze(toAudienceMap(CATALOG));

export const AUDIENCE_NAMES = Object.keys(AUDIENCES);

export const withCampaigns = (ids = []) => toAudienceMap(materializeCatalog(ids));
