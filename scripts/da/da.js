import { isAuthoringPreviewAllowed, resolvePreviewOrigin } from '../utils/security/preview-origin.js';

const daPreview = async (loadPage, {
  host = window.location.host,
  importer = null,
} = {}) => {
  if (!isAuthoringPreviewAllowed(host)) return;
  const { search } = window.location;
  const ref = new URLSearchParams(search).get('dapreview');
  if (!ref) return;
  const origin = resolvePreviewOrigin(ref, {
    onOrigin: 'https://da.live',
    localOrigin: 'http://localhost:3000',
    branchHost: 'da-live--adobe.aem.live',
  });
  if (!origin) return;
  const url = `${origin}/scripts/dapreview.js`;
  const mod = importer ? await importer(url) : await import(`${origin}/scripts/dapreview.js`);
  mod.default(loadPage);
};

export default daPreview;
