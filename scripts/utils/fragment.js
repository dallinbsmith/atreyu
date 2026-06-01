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
