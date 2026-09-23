// Persistent first-party visitor id (localStorage). Writes storage, so call
// only behind hasConsent('personalization') or an equivalent gate.
const VISITOR_KEY = 'atreyu-visitor-id';

export const getVisitorId = () => {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
};
