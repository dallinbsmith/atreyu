// The authoring "Experiment" table: one block holding every control for a
// whole-page test. It is not a rendered block. applyExperimentBlock runs before
// the plugin, turns the rows into the same head <meta> tags page metadata
// produces, and removes the table, so the plugin sees nothing new.
import { toClassName } from './config.js';

const ID_KEYS = new Set(['experiment', 'name', 'test', 'test-name', 'id', 'test-id']);

// Friendly row labels ("Test Name", "Split") map to plugin keys; labels
// already written the plugin way ("Experiment Split") work too.
export const metaName = (label) => {
  const key = toClassName(label).replace(/^experiment-/, '');
  if (!key) return null;
  return ID_KEYS.has(key) ? 'experiment' : `experiment-${key}`;
};

// Same cell rules as the plugin's section metadata: links, then paragraphs, then text.
export const cellValue = (col, { join = ', ' } = {}) => {
  const links = [...col.querySelectorAll('a')];
  if (links.length) return links.map((a) => a.getAttribute('href')).filter(Boolean).join(join);
  const paragraphs = [...col.querySelectorAll('p')].map((p) => p.textContent.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs.join(join) : col.textContent.trim();
};

export const readExperimentBlock = (block) => [...block.children]
  .filter((row) => row.children[1])
  .map((row) => [metaName(row.children[0].textContent), cellValue(row.children[1])])
  .filter(([name, value]) => name && value);

export const findExperimentBlocks = (doc) => [...doc.querySelectorAll('main .experiment')]
  .filter((block) => block.classList[0] === 'experiment');

// The first table wins; every table is removed so none ever renders. When the
// table defines a test it replaces all other experiment metadata on the page.
export const applyExperimentBlock = (doc = document) => {
  const [block, ...extra] = findExperimentBlocks(doc);
  if (!block) return null;
  const entries = readExperimentBlock(block);
  for (const el of [block, ...extra]) {
    const section = el.parentElement;
    el.remove();
    if (section?.parentElement?.matches('main') && ![...section.children].some((c) => !c.matches('.section-metadata'))) section.remove();
  }
  if (!entries.some(([name]) => name === 'experiment')) return null;
  doc.head.querySelectorAll('meta[name^="experiment"]').forEach((m) => m.remove());
  for (const [name, content] of entries) {
    const meta = doc.createElement('meta');
    meta.name = name;
    meta.content = content;
    doc.head.append(meta);
  }
  return Object.fromEntries(entries);
};
