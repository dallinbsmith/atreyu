import { loadArea } from '../ak.js';

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
  const resp = await fetch(`${path}`);
  if (!resp.ok) throw Error(`Couldn't fetch ${path}`);

  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  replaceDotMedia(path, doc);

  const sections = doc.body.querySelectorAll('main > div');
  const fragment = document.createElement('div');
  fragment.classList.add('fragment-content');
  fragment.append(...sections);

  const container = applyPageStyles(fragment);

  await loadArea({ area: fragment });

  fragment.remove();
  container.remove();

  return fragment;
};

// Bug-squash fix, 2026-08-28: header/footer request a locale-prefixed nav
// fragment (e.g. /ja-jp/system/fragments/nav/header), but only the root,
// unprefixed fragments are actually authored in DA — loadFragment() throws
// on the 404 with nothing upstream to catch it, so the one real translated
// page (/ja-jp/features/c2c.html) currently has no working nav at all. Tries
// each path in order, falling back to the next on failure; throws only if
// every path fails, same failure mode loadFragment() already has today.
export const loadFragmentWithFallback = async (paths) => {
  for (const path of paths) {
    try {
      // eslint-disable-next-line no-await-in-loop -- fallback paths are tried
      // in order, only as needed; not a parallelizable batch of independent work.
      return await loadFragment(path);
    } catch {
      // try the next path
    }
  }
  throw Error(`Couldn't fetch any of: ${paths.join(', ')}`);
};

export const getReplaceEl = (a) => {
  let current = a;
  const ancestor = a.closest('.section');

  while (current && current !== ancestor) {
    const childCount = current.parentElement.children.length;
    if (childCount <= 1) {
      current = current.parentElement;
    } else {
      break;
    }
  }

  return current;
};
