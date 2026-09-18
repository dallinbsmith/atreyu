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
import { MQ_GRID_CAP } from './utils/breakpoints.js';
import ENV from './utils/env.js';

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
    () => {
      if (config) return config;
      // Read before scripts.js's setConfig() ran. The lazy fallback below
      // produces a config missing hostnames/locales/linkBlocks/components, so
      // an early reader (decorateLink/loadBlock) would throw and poison the
      // singleton. Safe today by load order — warn (non-prod) so a future
      // import-order regression is loud, not silent. See scripts.md's Global
      // State & Data Flow. ENV is the designated env classifier, not an inline
      // hostname check (config-drift/no-inline-env-check).
      // eslint-disable-next-line no-console -- this warning IS the diagnostic (dev-only)
      if (ENV !== 'prod') console.warn('ak.js: getConfig() called before setConfig() — returning an incomplete default config.');
      return setConfig();
    },
  ];
})();

export const loadStyle = async (href) => {
  if (document.querySelector(`head > link[href="${href}"]`)) return null;
  const { promise, resolve } = Promise.withResolvers();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.addEventListener('load', resolve);
  link.addEventListener('error', resolve);
  document.head.append(link);
  return promise;
};

// Named and registered as a trusted `escape.methods` sanitizer in
// eslint.config.js's no-unsanitized/method config: codeBase is
// site-config-controlled (same-origin, never attacker input); type/name are
// bounded to whatever block/section .js files this repo actually ships (an
// unrecognized name just 404s, same as any AEM EDS site's standard
// block-loading mechanism — see e.g. Adobe's own aem-boilerplate).
const resolveModulePath = (codeBase, type, name) => `${codeBase}/${type}/${name}/${name}.js`;

export const loadExperience = async (el, type, name, opts) => {
  const { codeBase, log } = getConfig();
  const loading = [];
  if (opts.decorate) {
    loading.push(
      import(resolveModulePath(codeBase, type, name))
        .then((mod) => mod.default(el))
        .catch((ex) => log(ex, el)),
    );
  }
  if (opts.style) loading.push(loadStyle(`${codeBase}/${type}/${name}/${name}.css`));
  await Promise.all(loading);
  return el;
};

export const loadBlock = async (block) => {
  // Re-entrancy guard, restored from upstream aem-boilerplate's own
  // loadBlock() (block.dataset.blockStatus), dropped somewhere in this
  // fork's customization. Without it, loadArea() being called a second
  // time on the same, still-connected DOM (the real trigger: DA Quick
  // Edit's content-change callback re-runs loadPage() -> loadArea() on
  // the live document) re-invokes every already-decorated block's
  // default(el) a second time on the exact same el — most blocks guard
  // themselves individually against this (see scripts.md's Block
  // Lifecycle section), but nothing forced that, and this is the one
  // place that can guarantee it for every block, guarded or not.
  const status = block.dataset.blockStatus;
  if (status === 'loading' || status === 'loaded') return block;
  block.dataset.blockStatus = 'loading';

  const { components } = getConfig();
  const { classList } = block;
  const name = classList[0];
  block.dataset.blockName = name;
  // Author-typed variant tokens (`Block (large, dark)` → class="block large dark"),
  // mirrored into a stable attribute so a future styling-driven class rename
  // never silently breaks a test/analytics selector keyed on the variant.
  if (classList.length > 1) block.dataset.variant = [...classList].slice(1).join(' ');
  const opts = {
    decorate: true,
    style: !components.some((cmp) => name === cmp),
  };
  await loadExperience(block, 'blocks', name, opts);
  block.dataset.blockStatus = 'loaded';
  return block;
};

const loadTemplate = () => {
  const meta = getMetadata('template');
  if (!meta) return;
  const template = meta.replaceAll(' ', '-').toLowerCase();
  const { codeBase } = getConfig();
  document.body.classList.add('has-template');
  loadStyle(`${codeBase}/templates/${template}/${template}.css`)
    .then(() => {
      document.body.classList.add(`${template}-template`);
      return document.body.classList.remove('has-template');
    })
    .catch((ex) => getConfig().log(ex));
};

const decoratePictures = (el) => {
  const pics = el.querySelectorAll('picture');
  for (const pic of pics) {
    // Guard against loadArea() re-running on the same DOM (see loadBlock()'s
    // comment): without it, a second pass would find the clone this
    // function itself just prepended (also a real <source>), clone that,
    // and prepend yet another — one extra duplicate <source> per re-run.
    const source = !pic.dataset.gridSource && pic.querySelector('source');
    if (source) {
      pic.dataset.gridSource = 'true';
      const clone = source.cloneNode();
      const [pathname, params] = clone.getAttribute('srcset').split('?');
      const search = new URLSearchParams(params);
      search.set('width', 3000);
      clone.setAttribute('srcset', `${pathname}?${search.toString()}`);
      clone.setAttribute('media', MQ_GRID_CAP);
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
  // **bold** = white, *italic* = ghost, ***bold italic*** = glass. Role
  // names (not class names) are the source of truth here — the testid
  // below is built from these same roles, never reverse-engineered from
  // the CSS class list, so renaming a class for styling reasons can never
  // silently change a stable testid/analytics identifier.
  const roles = [
    [isStrike, 'negative'],
    [isEm && isStrong, 'glass'],
    [isStrong, 'primary'],
    [isEm, 'secondary'],
  ];
  const variantRole = roles.find(([cond]) => cond)?.[1];
  if (variantRole) link.classList.add(`btn-${variantRole}`);
  if (isUnder) {
    link.classList.add('btn-outline');
    link.append(...isUnder.childNodes);
    isUnder.remove();
  }
  const toReplace = [isEm, isStrong, isStrike].find((el) => el?.parentNode === trueParent);
  if (toReplace) toReplace.replaceWith(link);

  // Primary test/analytics selector (see scripts.md's Selectors & Data
  // Attributes) — derived from the nearest real block, not author-typed.
  // Only instrumented when a block ancestor exists; a plain-content button
  // (outside any named block) has no stable block prefix to key off.
  const block = link.closest('.block-content > div[class]');
  if (block) {
    const testidRole = [variantRole, isUnder && 'outline'].filter(Boolean).join('-') || 'default';
    link.dataset.testid ||= `${block.classList[0]}-cta-${testidRole}`;
  }
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
  import('./utils/media/icons.js')
    .then((mod) => mod.default(icons))
    .catch((ex) => getConfig().log(ex));
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
      // Reserved `anchor` key → a real, deep-linkable section id (marketing
      // deep-links, in-page jump nav). Slugified via toClassName — lowercase,
      // mirroring the standard EDS heading-slug convention so a section anchor
      // reads like a heading anchor (exact server-pipeline parity is not
      // verifiable from this repo; the document-wide de-dup below is the safety
      // net for any residual mismatch). De-duped with a
      // numeric suffix (against the whole document, so it also can't collide
      // with a heading's own id) — none of the reference EDS sites this was
      // modelled on (cmegroup/vitamix/stericycle) did that. Assigned here in
      // eager section decoration (decorateSections runs over every section
      // before the block-load loop and before lazy.js imports lazyhash.js), so
      // the id exists before lazyhash's scrollIntoView fires on a cold
      // deep-link to a below-fold section.
      if (key === 'anchor') {
        const base = toClassName(text);
        let id = base;
        let n = 2;
        // CSS.escape (not getElementById): a slug can start with a digit
        // (`2024-roadmap`), an invalid bare CSS selector — same reason
        // lazyhash.js escapes before querying these very ids.
        while (id && document.querySelector(`#${CSS.escape(id)}`)) {
          id = `${base}-${n}`;
          n += 1;
        }
        if (id) section.id = id;
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
    // Persistent guard (distinct from the transient `dataset.status`
    // reveal-gate below — see styles.css's `div[data-status]` rule) against
    // loadArea() re-running on the same, still-connected DOM (see
    // loadBlock()'s guard comment above for the real trigger). Without it,
    // groupChildren() would re-wrap an already-wrapped section's
    // .block-content/.default-content divs in a second layer of the same
    // wrappers on every re-decoration, corrupting the structure and making
    // `.block-content > div[class]` below also match the newly-nested
    // wrapper div itself.
    if (!section.dataset.sectionStatus) {
      decorateSection(section);
      const groups = groupChildren(section);
      section.append(...groups);
      section.dataset.status = 'decorated';
      section.dataset.sectionStatus = 'decorated';
    }
    // Re-run every time, guarded re-decoration or not: this is how content
    // added to an already-decorated section (a real Quick Edit case) gets
    // picked up. Safe to repeat over already-processed links/blocks —
    // decorateLink() is idempotent and loadBlock() has its own guard.
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
  // The `.skip-to-content` check guards against loadArea() re-running on
  // the same document (see loadBlock()'s comment) — without it, every
  // re-decoration prepends another skip link.
  if (!main || document.body.querySelector('.skip-to-content')) return;
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
      import('./postlcp.js')
        .then((mod) => mod.default())
        .catch((ex) => getConfig().log(ex));
    }
  }
  // Bug-squash fix, 2026-09-18: was a bare `import('./lazy.js')` with no
  // `.then()` — safe for lazy.js's one-shot bootstrap IIFE, but silently
  // meant nothing in its real default export (footer/pzn re-decoration) ever
  // ran on a second loadArea() call, since a repeat import of an
  // already-evaluated module resolves from cache without re-running
  // anything. `mod.default()` is a real function reference, so calling it
  // here re-fires correctly every time, matching postlcp.js's identical
  // pattern above.
  if (isDoc) {
    import('./lazy.js')
      .then((mod) => mod.default())
      .catch((ex) => getConfig().log(ex));
  }
};
