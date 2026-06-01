import toggleScheduler from '../scheduler/scheduler.js';
import initQuickEdit from '../quick-edit/quick-edit.js';
import initValidation from './validation.js';

export default async (sk) => {
  sk.addEventListener('custom:scheduler', toggleScheduler);
  sk.addEventListener('custom:quick-edit', initQuickEdit);
  sk.addEventListener('custom:validation', initValidation);
  sk.classList.add('is-ready');
};
