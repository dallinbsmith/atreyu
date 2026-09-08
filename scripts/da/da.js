import { resolvePreviewOrigin } from '../utils/preview-origin.js';

const daPreview = async (loadPage) => {
  const { search } = window.location;
  const ref = new URLSearchParams(search).get('dapreview');
  if (!ref) return;
  const origin = resolvePreviewOrigin(ref, {
    onOrigin: 'https://da.live',
    localOrigin: 'http://localhost:3000',
    branchHost: 'da-live--adobe.aem.live',
  });
  if (!origin) return;
  const mod = await import(`${origin}/scripts/dapreview.js`);
  mod.default(loadPage);
};

export default daPreview;
