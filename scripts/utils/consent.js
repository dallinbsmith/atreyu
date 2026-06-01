const STORAGE_KEY = 'atreyu-consent';
const CATEGORIES = ['necessary', 'analytics', 'marketing', 'personalization'];
const DEFAULTS = Object.fromEntries(CATEGORIES.map((c) => [c, c === 'necessary']));

const isValid = (obj) => obj
  && typeof obj === 'object'
  && CATEGORIES.every((c) => typeof obj[c] === 'boolean');

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? { ...parsed, necessary: true } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
};

let state = load();

const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
};

const dispatch = () => {
  document.dispatchEvent(new CustomEvent('atreyu:consent', { detail: { ...state } }));
};

export const getConsent = () => ({ ...state });

export const hasConsent = (category) => (category === 'necessary' ? true : !!state[category]);

export const setConsent = (categories) => {
  const merged = { ...state };
  Object.entries(categories).forEach(([key, val]) => {
    if (CATEGORIES.includes(key) && key !== 'necessary') merged[key] = !!val;
  });
  state = merged;
  persist();
  dispatch();
};

export const onConsentChange = (callback) => {
  document.addEventListener('atreyu:consent', callback);
  return () => document.removeEventListener('atreyu:consent', callback);
};

export const resetConsent = () => {
  state = { ...DEFAULTS };
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* quota */ }
  dispatch();
};
