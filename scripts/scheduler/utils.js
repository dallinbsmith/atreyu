// Author-only (Sidekick date simulator, non-prod). Deliberately NOT on
// utils/i18n.js formatDate: this shows the author's own clock next to their
// browser-rendered datetime-local input, so the browser locale ([]) is right
// here, not the page locale. Visitor-facing dates use utils/i18n.js.
export const formatDate = (timestamp, timeZone) => {
  const rawDate = timestamp ? new Date(timestamp) : new Date();
  const date = rawDate.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', timeZone });
  const time = rawDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone });
  return { date, time };
};
