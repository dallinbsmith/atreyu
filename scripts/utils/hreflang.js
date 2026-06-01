import { getConfig } from '../ak.js';

const hreflang = () => {
  const { locales, locale } = getConfig();
  const { origin, pathname } = window.location;
  const basePath = locale.prefix ? pathname.replace(locale.prefix, '') : pathname;

  const append = (lang, href) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = lang;
    link.href = href;
    document.head.append(link);
  };

  Object.entries(locales).forEach(([prefix, { lang }]) => {
    append(lang, `${origin}${prefix}${basePath}`);
  });

  append('x-default', `${origin}${basePath}`);
};

export default hreflang;
