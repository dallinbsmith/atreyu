import { getConfig, getMetadata } from '../ak.js';

const createLink = (rel, href) => {
  const link = document.createElement('link');
  link.setAttribute('rel', rel);
  link.setAttribute('href', href);
  return link;
};

(async () => {
  const { codeBase } = getConfig();
  const name = getMetadata('favicon') || 'favicon';
  const favBase = `${codeBase}/img/favicons/${name}`;

  document.head.append(
    createLink('apple-touch-icon', `${favBase}-180.png`),
    createLink('manifest', `${favBase}.webmanifest`),
  );

  const favicon = document.head.querySelector('link[href="data:,"]');
  if (favicon) favicon.href = `${favBase}.ico`;
})();
