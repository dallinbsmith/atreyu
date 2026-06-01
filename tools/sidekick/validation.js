import { runSyncRules, runLinkCheck } from './validation-rules.js';
import { createPanel, updateRow, removePanel, isPanelOpen } from './validation-panel.js';

export default () => {
  if (isPanelOpen()) {
    removePanel();
    return;
  }

  const results = [
    ...runSyncRules(),
    { label: 'Internal links', status: 'pass', message: 'Checking...' },
  ];

  const panel = createPanel(results);
  runLinkCheck((data) => updateRow(panel, 'Internal links', data));
};
