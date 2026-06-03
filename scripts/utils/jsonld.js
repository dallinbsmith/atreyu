import { getMetadata } from '../ak.js';

const SITE = {
  name: 'Frame.io',
  url: 'https://frame.io',
  parent: { name: 'Adobe', url: 'https://www.adobe.com' },
  sameAs: [
    'https://twitter.com/frameio',
    'https://www.linkedin.com/company/frame-io',
    'https://www.youtube.com/@frameio',
    'https://www.instagram.com/frame.io',
  ],
};

const graph = [];
let scriptEl = null;

const writeGraph = () => {
  const payload = {
    '@context': 'https://schema.org',
    '@graph': graph.map(({ '@context': _, ...rest }) => rest),
  };
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.type = 'application/ld+json';
    document.head.append(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(payload);
};

export const inject = (data) => {
  graph.push(data);
  if (scriptEl) writeGraph();
};

export const flush = () => {
  writeGraph();
};

const buildOrganization = () => ({
  '@type': 'Organization',
  '@id': `${SITE.url}/#organization`,
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/icons/frame-io-logo.svg`,
  parentOrganization: {
    '@type': 'Organization',
    name: SITE.parent.name,
    url: SITE.parent.url,
  },
  sameAs: SITE.sameAs,
});

const buildWebSite = () => ({
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  name: SITE.name,
  url: SITE.url,
  publisher: { '@id': `${SITE.url}/#organization` },
});

const buildSoftwareApplication = () => ({
  '@type': 'SoftwareApplication',
  name: SITE.name,
  url: SITE.url,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Web, macOS, iOS',
  description: getMetadata('description') || 'Video collaboration and review platform by Adobe.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '0',
    offerCount: '4',
  },
  author: { '@id': `${SITE.url}/#organization` },
});

// Human labels for slugs that title-casing would mangle (e.g. "c2c" → "C2c").
const BREADCRUMB_LABELS = {
  c2c: 'Camera to Cloud',
};

const labelFor = (segment) => BREADCRUMB_LABELS[segment]
  ?? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const buildBreadcrumbs = () => {
  const { pathname } = window.location;
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return null;

  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url }];
  let path = '';
  for (const [idx, segment] of segments.entries()) {
    path += `/${segment}`;
    items.push({
      '@type': 'ListItem',
      position: idx + 2,
      name: labelFor(segment),
      item: `${SITE.url}${path}`,
    });
  }

  return {
    '@type': 'BreadcrumbList',
    '@id': `${SITE.url}${pathname}#breadcrumb`,
    itemListElement: items,
  };
};

const buildWebPage = () => {
  const { pathname } = window.location;
  const title = getMetadata('og:title') || document.title;
  const description = getMetadata('description');
  const image = getMetadata('og:image');

  const page = {
    '@type': 'WebPage',
    '@id': `${SITE.url}${pathname}#webpage`,
    name: title,
    url: window.location.href,
    isPartOf: { '@id': `${SITE.url}/#website` },
  };
  if (description) page.description = description;
  if (image) page.image = image;

  const breadcrumbs = buildBreadcrumbs();
  if (breadcrumbs) page.breadcrumb = { '@id': breadcrumbs['@id'] };

  return page;
};

export default () => {
  inject(buildOrganization());
  inject(buildWebSite());

  const template = getMetadata('template');
  if (template === 'pricing' || window.location.pathname.includes('/pricing')) {
    inject(buildSoftwareApplication());
  }

  const breadcrumbs = buildBreadcrumbs();
  if (breadcrumbs) inject(breadcrumbs);

  inject(buildWebPage());
  flush();
};
