import { getMetadata } from '../ak.js';
import { emit } from './event-bus.js';
import { track } from './analytics.js';

const VISITOR_KEY = 'atreyu-visitor-id';

export const getVisitorId = () => {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
};

// Deterministic numeric hash — djb2-style using only arithmetic (no bitwise ops)
const hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h, 33) + str.charCodeAt(i);
  }
  return Math.abs(h);
};

const getBucket = (experiment, visitorId, count) => hash(`${experiment}:${visitorId}`) % count;

const fetchVariantContent = async (path) => {
  const resp = await fetch(`${path}.plain.html`);
  if (!resp.ok) return null;
  return resp.text();
};

const applyVariant = (html) => {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = html;
};

export const runExperiment = async () => {
  const experiment = getMetadata('experiment');
  if (!experiment) return null;

  const variantsMeta = getMetadata('experiment-variants');
  if (!variantsMeta) return null;

  const variantPaths = variantsMeta.split(',').map((p) => p.trim()).filter(Boolean);
  if (!variantPaths.length) return null;

  const allVariants = ['control', ...variantPaths];
  const visitorId = getVisitorId();
  const bucket = getBucket(experiment, visitorId, allVariants.length);
  const variant = allVariants[bucket];
  const isControl = bucket === 0;

  if (!isControl) {
    try {
      const html = await fetchVariantContent(variant);
      if (html) applyVariant(html);
    } catch { /* control fallback — original content stays */ }
  }

  const detail = { experiment, variant, bucket };
  emit('experiment', detail);
  track('experiment', detail);
  return { experiment, variant };
};
