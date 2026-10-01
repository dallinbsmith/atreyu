import { getConfig, loadArea } from '../ak.js';

const replaceDotMedia = (path, doc) => {
  const resetAttributeBase = (tag, attr) => {
    for (const el of doc.querySelectorAll(`${tag}[${attr}^="./media_"]`)) {
      el[attr] = new URL(el.getAttribute(attr), new URL(path, window.location)).href;
    }
  };
  resetAttributeBase('img', 'src');
  resetAttributeBase('source', 'srcset');
};

const applyPageStyles = (fragment) => {
  const container = document.createElement('div');
  container.classList.add('hidden-container');
  container.style = 'display: none';
  document.body.append(container);
  container.append(fragment);
  return container;
};

export const loadFragment = async (path) => {
  const resp = await fetch(path);
  if (!resp.ok) throw Error(`Couldn't fetch ${path}`);

  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  replaceDotMedia(path, doc);

  const sections = doc.body.querySelectorAll('main > div');
  const fragment = document.createElement('div');
  fragment.classList.add('fragment-content');
  fragment.append(...sections);

  const container = applyPageStyles(fragment);
  try {
    await loadArea({ area: fragment });
  } finally {
    fragment.remove();
    container.remove();
  }

  return fragment;
};

// The one locale → root fallback rule for every fragment surface (header,
// footer, language menu, fragment block, schedule): the current locale's copy
// first, then the root copy, since most fragments are only authored at root.
// The current locale prefix is stripped first (ak.js decorateLink has usually
// localized the href already) on a path boundary, so /ja-jpx is not /ja-jp.
// A path under another locale (authored on purpose) or an absolute/off-site
// URL is used as-is (the same skip rules as ak.js localizeUrl; keep them in
// sync). Root locale: just [path].
export const localeCandidates = (path) => {
  const { locale: { prefix }, locales = {} } = getConfig();
  const bare = prefix && path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
  const sitePath = bare.startsWith('/') && !bare.startsWith('//');
  const otherLocale = Object.keys(locales).some((key) => key && bare.startsWith(`${key}/`));
  return sitePath && !otherLocale ? [...new Set([`${prefix}${bare}`, bare])] : [bare];
};

// Bug-squash fix, 2026-08-28: only the root, unprefixed nav fragments are
// actually authored in DA, and loadFragment() throws on the locale 404 with
// nothing upstream to catch it. Tries each localeCandidates(path) in order,
// falling back to the next on failure; throws only if every path fails, with
// each candidate's error as a cause.
export const loadFragmentWithFallback = async (path) => {
  const paths = localeCandidates(path);
  const errors = [];
  for (const candidate of paths) {
    try {
      // eslint-disable-next-line no-await-in-loop -- fallback paths are tried
      // in order, only as needed; not a parallelizable batch of independent work.
      return await loadFragment(candidate);
    } catch (ex) {
      errors.push(ex);
    }
  }
  throw new AggregateError(errors, `Couldn't fetch any of: ${paths.join(', ')}`);
};

export const getReplaceEl = (a) => {
  let current = a;
  const ancestor = a.closest('.section');

  // `current.parentElement` guard: a detached anchor, or one outside any
  // `.section`, has `ancestor === null`, so without it the loop would climb
  // past the tree root and throw on `null.children`. Author-supplied anchors
  // (fragment.js, schedule.js) can be detached by a prior swap.
  while (current && current !== ancestor && current.parentElement) {
    const childCount = current.parentElement.children.length;
    if (childCount <= 1) {
      current = current.parentElement;
    } else {
      break;
    }
  }

  // No parent means nowhere to insert: `.after()` on a parentless node is a
  // silent no-op, so return null and let the caller log and bail visibly.
  return current.parentElement ? current : null;
};

// Page-lifetime counter, folded into each fragment's id alongside path/idx so
// two separate anchors pointing at the same fragment path never collide on
// the same DOM id (scripts/utils/page/lazyhash.js scrollIntoView()s to a captured
// id — a collision means a deep link to the second instance silently lands
// on the first). Safe as page-lifetime module state: there's only ever one
// page's worth of fragment decorations happening, not per-instance state
// that could leak across independent block instances.
let fragmentInstance = 0;

// `path` is optional — when omitted (e.g. blocks/schedule/schedule.js, which
// doesn't want deep-link ids on scheduled event fragments), children get no
// ids and the loop just inserts/removes.
export const replaceElWithFragment = (elToReplace, fragment, path) => {
  const instance = fragmentInstance;
  fragmentInstance += 1;

  const sections = fragment.querySelectorAll(':scope > .section');
  const children = sections.length === 1
    ? fragment.querySelectorAll(':scope > *')
    : [fragment];
  for (const [idx, child] of children.entries()) {
    // `||=`: an authored section id (Id/Anchor section metadata) wins over the
    // generated one (B2). Nothing decodes the generated id; lazyhash only
    // scrolls to whatever id the hash names.
    if (path?.startsWith('/')) child.id ||= btoa(encodeURIComponent(`${path}/${idx + 1}/${instance}`));
    elToReplace.after(child);
  }
  elToReplace.remove();
};
