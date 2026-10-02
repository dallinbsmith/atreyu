// Loaded eagerly on every page; must stay tiny and never import the loader,
// plugin or ak.js. Decides whether experimentation code loads at all.
import { toClassName } from './class-name.js';

const CONFIG_BLOCKS = ['personalize', 'experiment'];
export const PLUGIN_KEY_PREFIXES = ['experiment', 'audience', 'campaign'];
const PREVIEW_PARAMS = ['experiment', 'audience'];

const metaSelectors = (prefix) => [`[name^="${prefix}"]`, `[property^="${prefix}:"]`];

export const EXPERIMENT_META_SELECTOR = PLUGIN_KEY_PREFIXES.flatMap(metaSelectors).join(',');

// Keys (toClassName'd) the plugin reads in Section Metadata. .page/.live
// flatten authored rows to data-*, so the plugin never sees them; strip them
// from raw DA markup (Quick Edit, dapreview) to match.
export const isPluginKey = (key, prefixes = PLUGIN_KEY_PREFIXES) => prefixes
  .some((p) => key === p || key.startsWith(`${p}-`));

// Config tables are authoring input, never rendered blocks. Match on the
// first class only, so a rendered block with a `personalize` variant class
// is not mistaken for one.
export const findConfigBlocks = (root, names = CONFIG_BLOCKS) => [
  ...(root?.querySelectorAll(names.map((name) => `.${name}`).join(', ')) ?? []),
].filter((block) => names.includes(block.classList[0]));

const hasHeadMetaSignal = (doc) => Boolean(doc.head?.querySelector(EXPERIMENT_META_SELECTOR));

const hasSectionMetaSignal = (doc) => [...doc.querySelectorAll('main .section-metadata > div')]
  .some((row) => isPluginKey(toClassName(row.children[0]?.textContent)));

const hasConfigBlockSignal = (doc) => findConfigBlocks(doc.querySelector('main')).length > 0;

export const hasPreviewSignal = () => {
  const params = new URLSearchParams(window.location.search);
  return PREVIEW_PARAMS.some((p) => params.has(p));
};

// "Compiled" means config tables have already become metadata and been removed.
export const hasCompiledExperimentSignal = (doc = document) => (
  hasHeadMetaSignal(doc) || hasSectionMetaSignal(doc)
);

export const hasExperimentSignal = (doc = document) => (
  hasConfigBlockSignal(doc) || hasCompiledExperimentSignal(doc)
);

const hasAuthoredContent = (section) => [...section.children]
  .some((child) => !child.matches('.section-metadata'));

export const removeConfigBlock = (block) => {
  const section = block.closest('main > div');
  block.remove();
  if (!section || hasAuthoredContent(section)) return false;
  section.remove();
  return true;
};

export const removeLeftoverConfigBlocks = (main = document.querySelector('main')) => {
  for (const block of findConfigBlocks(main)) removeConfigBlock(block);
};

export const catchImportError = (promise, log) => promise?.catch((ex) => {
  log(ex);
});
