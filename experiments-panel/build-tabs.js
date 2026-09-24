import { createElement as h } from '../scripts/utils/dom.js';
import { fetchText } from './sources.js';
import renderBuild from './form.js';
import renderPersonalize from './personalize-form.js';

const renderFormTab = async ({
  pageError, pagePath, port, renderer,
}) => {
  if (pageError) return [h('p', { className: 'error' }, pageError)];
  const pageHtml = await fetchText(pagePath).catch(() => null);
  const scratch = h('div');
  renderer({
    view: scratch, pagePath, port, pageHtml,
  });
  return [...scratch.childNodes];
};

export const renderBuildTab = (opts) => renderFormTab({ ...opts, renderer: renderBuild });

export const renderPersonalizeTab = (opts) => renderFormTab({
  ...opts,
  renderer: renderPersonalize,
});
