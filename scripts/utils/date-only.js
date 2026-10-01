// A full `YYYY-MM-DD` calendar date (captures year, month, day). Shared by
// utils/i18n.js formatDate and the Personalize End Date (experiments/personalize.js,
// experiments-panel/personalize-table.js). Leaf module, no imports: i18n.js
// imports ak.js, so taking it from there pulled ak.js into the experiments
// utils and the panel.
export const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
