/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { tagBehavior } from './behaviors.js';

const LOG = async (ex, el) => (await import('./utils/error.js')).default(ex, el);

export const getMetadata = (name) => {
  const attr = name?.includes(':') ? 'property' : 'name';
  const meta = document.head.querySelector(`meta[${attr}="${name}"]`);
  return meta?.content;
};

export const getLocale = (locales = { '': {} }) => {
  const { pathname } = window.location;
  const matches = Object.keys(locales).filter((locale) => pathname.startsWith(`${locale}/`));
  const prefix = getMetadata('locale') || matches.sort((a, b) => b.length - a.length)?.at(0) || '';
  if (locales[prefix].lang) document.documentElement.lang = locales[prefix].lang;
  return { prefix, ...locales[prefix] };
};

export const [setConfig, getConfig] = (() => {
  let config;
  return [
    (conf = {}) => {
      config = {
        ...conf,
        log: conf.log || LOG,
        locale: getLocale(conf.locales),
        codeBase: `${import.meta.url.replace('/scripts/ak.js', '')}`,
      };
      return config;
    },
    () => (config || setConfig()),
  ];
})();

export const loadStyle = async (href) => {
  if (document.querySelector(`head > link[href="${href}"]`)) return null;
  const { promise, resolve } = Promise.withResolvers();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.onload = resolve;
  link.onerror = resolve;
  document.head.append(link);
  return promise;
};

export const loadExperience = async (el, type, name, opts) => {
  const { codeBase, log } = getConfig();
  const path = `${codeBase}/${type}/${name}/${name}`;
  const loading = [];
  if (opts.decorate) {
    loading.push(
      import(`${path}.js`)
        .then((mod) => mod.default(el))
        .catch((ex) => log(ex, el)),
    );
  }
  if (opts.style) loading.push(loadStyle(`${path}.css`));
  await Promise.all(loading);
  return el;
};

export const loadBlock = async (block) => {
  const { components } = getConfig();
  const { classList } = block;
  const name = classList[0];
  block.dataset.blockName = name;
  const opts = {
    decorate: true,
    style: !components.some((cmp) => name === cmp),
  };
  return loadExperience(block, 'blocks', name, opts);
};

const loadTemplate = () => {
  const meta = getMetadata('template');
  if (!meta) return;
  const template = meta.replaceAll(' ', '-').toLowerCase();
  const { codeBase } = getConfig();
  document.body.classList.add('has-template');
  loadStyle(`${codeBase}/templates/${template}/${template}.css`).then(() => {
    document.body.classList.add(`${template}-template`);
    document.body.classList.remove('has-template');
  });
};

const decoratePictures = (el) => {
  const pics = el.querySelectorAll('picture');
  for (const pic of pics) {
    const source = pic.querySelector('source');
    if (source) {
      const clone = source.cloneNode();
      const [pathname, params] = clone.getAttribute('srcset').split('?');
      const search = new URLSearchParams(params);
      search.set('width', 3000);
      clone.setAttribute('srcset', `${pathname}?${search.toString()}`);
      clone.setAttribute('media', '(min-width: 1440px)');
      pic.prepend(clone);
    }
  }
};

const decorateButton = (link) => {
  const isEm = link.closest('em');
  const isStrong = link.closest('strong');
  const isStrike = link.closest('del');
  const isUnder = link.querySelector('u');
  if (!(isEm || isStrong || isStrike || isUnder)) return;
  const trueParent = link.closest('p, li, div');
  if (!trueParent) return;
  const siblings = [...trueParent.childNodes];

  const hasSibling = siblings.every(
    (el) => el.nodeName === 'A'
    || el.nodeName === 'EM'
    || el.nodeName === 'STRONG'
    || el.nodeName === 'DEL'
    || !el.textContent.trim(),
  );
  if (!hasSibling) return;
  if (siblings.length > 1) trueParent.classList.add('btn-group');

  link.classList.add('btn');
  // Frame.io's three button color schemes, reachable via emphasis marks:
  // **bold** = white, *italic* = ghost, ***bold italic*** = glass.
  const variants = [
    [isStrike, 'btn-negative'],
    [isEm && isStrong, 'btn-glass'],
    [isStrong, 'btn-primary'],
    [isEm, 'btn-secondary'],
  ];
  const variant = variants.find(([cond]) => cond)?.[1];
  if (variant) link.classList.add(variant);
  if (isUnder) {
    link.classList.add('btn-outline');
    link.innerHTML = isUnder.innerHTML;
    isUnder.remove();
  }
  const toReplace = [isEm, isStrong, isStrike].find((el) => el?.parentNode === trueParent);
  if (toReplace) trueParent.replaceChild(link, toReplace);
};

export const localizeUrl = ({ config, url }) => {
  const { locales, locale } = config;

  if (locale.prefix === '') return null;

  const { origin, pathname, search, hash } = url;

  if (pathname.startsWith(`${locale.prefix}/`)) return null;

  const localized = Object.keys(locales).some(
    (key) => key !== '' && pathname.startsWith(`${key}/`),
  );
  if (localized) return null;

  return new URL(`${origin}${locale.prefix}${pathname}${search}${hash}`);
};

const decorateHash = (a, url) => {
  const { hash } = url;
  if (!hash || hash === '#') return {};

  const findHash = (name) => {
    const found = hash.includes(name);
    if (found) a.href = a.href.replace(name, '');
    return found;
  };

  const blank = findHash('#_blank');
  if (blank) a.target = '_blank';

  const dnt = findHash('#_dnt');
  const dnb = findHash('#_dnb');
  return { dnt, dnb };
};

export const decorateLink = (config, a) => {
  try {
    const url = new URL(a.href);
    const hostMatch = config.hostnames.some((host) => url.hostname.endsWith(host));
    if (hostMatch) a.href = a.href.replace(url.origin, '');

    const isRelative = a.getAttribute('href').startsWith('/');
    if (!isRelative) a.rel = 'noopener noreferrer';
    const { dnt, dnb } = decorateHash(a, url);
    if (isRelative && !dnt) {
      const localized = localizeUrl({ config, url });
      if (localized) a.href = localized.href;
    }
    decorateButton(a);
    tagBehavior(a);
    if (!dnb) {
      const href = a.getAttribute('href');
      const found = config.linkBlocks.some((pattern) => {
        const key = Object.keys(pattern)[0];
        if (!href.includes(pattern[key])) return false;
        a.classList.add(key, 'auto-block');
        return true;
      });
      if (found) return a;
    }
  } catch (ex) {
    config.log('Could not decorate link', ex);
  }
  return null;
};

const decorateLinks = (el) => {
  const config = getConfig();
  return [...el.querySelectorAll('a')]
    .map((a) => decorateLink(config, a))
    .filter(Boolean);
};

const loadIcons = (el) => {
  const icons = el.querySelectorAll('span.icon');
  if (!icons.length) return;
  import('./utils/icons.js').then((mod) => mod.default(icons));
};

const groupChildren = (section) => {
  const children = section.querySelectorAll(':scope > *');
  const groups = [];
  let currentGroup = null;
  for (const child of children) {
    const isDiv = child.tagName === 'DIV';
    const currentType = currentGroup?.classList.contains('block-content');

    if (!currentGroup || currentType !== isDiv) {
      currentGroup = document.createElement('div');
      currentGroup.className = isDiv
        ? 'block-content' : 'default-content';
      groups.push(currentGroup);
    }

    currentGroup.append(child);
  }
  return groups;
};

const toClassName = (name) => (typeof name === 'string'
  ? name
    .toLowerCase()
    .replace(/[^0-9a-z]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  : '');

const decorateSection = (section) => {
  section.classList.add('section');

  const metaEl = section.querySelector(':scope > .section-metadata');
  if (metaEl) {
    [...metaEl.children].forEach((row) => {
      const key = row.children[0].textContent.trim().toLowerCase();
      const content = row.children[1];
      if (!content) return;
      const text = content.querySelector('img')?.src ?? content.textContent.trim().toLowerCase();
      if (!(key && text)) return;
      if (key === 'style') {
        const styles = text.split(',').map((style) => toClassName(style));
        section.classList.add(...styles);
        return;
      }
      section.dataset[key] = text;
    });
    metaEl.remove();
  }

  const meta = section.classList.length > 1 || Object.keys(section.dataset).length;
  if (meta) section.dataset.meta = meta;
};

const decorateSections = (parent, isDoc) => {
  const selector = isDoc ? 'main > div' : ':scope > div';
  return [...parent.querySelectorAll(selector)].map((section) => {
    decorateSection(section);
    const groups = groupChildren(section);
    section.append(...groups);
    section.dataset.status = 'decorated';
    section.linkBlocks = decorateLinks(section);
    section.blocks = [...section.querySelectorAll('.block-content > div[class]')];
    return section;
  });
};

const decorateHeader = () => {
  const header = document.querySelector('header');
  if (!header) return;
  const meta = getMetadata('header') || 'header';
  if (meta === 'off') {
    document.body.classList.add('no-header');
    header.remove();
    return;
  }
  header.className = meta;
  header.dataset.status = 'decorated';
  const breadcrumbs = document.body.querySelector('breadcrumbs');
  const breadcrumbsPath = getMetadata('breadcrumbs');
  if (!(breadcrumbs || breadcrumbsPath)) return;
  document.body.classList.add('has-breadcrumbs');
  if (breadcrumbs) header.append(breadcrumbs);
};

const decorateSession = () => {
  sessionStorage.setItem('session', true);
  document.body.classList.add('session');
};

const decorateSkipToContent = () => {
  const main = document.querySelector('main');
  if (!main) return;
  main.id ||= 'main';
  const skip = document.createElement('a');
  skip.href = `#${main.id}`;
  skip.className = 'skip-to-content';
  skip.textContent = 'Skip to content';
  document.body.prepend(skip);
};

const decorateDoc = () => {
  decorateHeader();
  decorateSkipToContent();
  loadTemplate();

  const scheme = localStorage.getItem('color-scheme');
  if (scheme) document.body.classList.add(scheme);

  const pageId = window.location.hash?.replace('#', '');
  if (pageId) localStorage.setItem('lazyhash', pageId);
};

export const loadArea = async ({ area } = { area: document }) => {
  const isDoc = area === document;
  const isSession = sessionStorage.getItem('session');
  if (isDoc) {
    if (isSession) await decorateSession();
    decorateDoc();
  }
  decoratePictures(area);
  const { decorateArea } = getConfig();
  if (decorateArea) decorateArea({ area });
  const sections = decorateSections(area, isDoc);
  for (const [idx, section] of sections.entries()) {
    loadIcons(section);
    await Promise.all(section.linkBlocks.map((block) => loadBlock(block)));
    await Promise.all(section.blocks.map((block) => loadBlock(block)));
    if (section.dataset.meta) {
      const opts = { decorate: true, style: true };
      await loadExperience(section, 'blocks', 'section-metadata', opts);
      delete section.dataset.meta;
    }

    delete section.dataset.status;
    if (isDoc && idx === 0) {
      if (!isSession) decorateSession();
      import('./postlcp.js').then((mod) => mod.default());
    }
  }
  if (isDoc) import('./lazy.js');
};
