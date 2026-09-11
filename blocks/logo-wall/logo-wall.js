import { createElement } from '../../scripts/utils/dom.js';
import { shouldAnimate, addPauseToggle } from '../../scripts/utils/motion/motion.js';
import { buildAccessibleLogo } from '../../scripts/utils/partner-logo.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

// Authoring: one partner/brand per row — plain text, or a link (href =
// partner site, text = name). Auto-scrolling marquee, failing open to a
// static list under reduced motion / low-power devices.

const LOGO_HEIGHT = 32;

const extractItems = (el) => [...el.children].map((row) => {
  const link = row.querySelector('a');
  return { name: (link ?? row).textContent.trim(), href: link?.href ?? '' };
}).filter(({ name }) => name);

const buildItem = ({ name, href }) => {
  const { icon, label, load } = buildAccessibleLogo(name, LOGO_HEIGHT);
  icon.classList.add('logo-wall-icon');
  return {
    load,
    li: createElement('li', null, createElement(href ? 'a' : 'span', {
      className: 'logo-wall-item', href: href || null,
    }, icon, label)),
  };
};

const buildTrack = (items) => {
  const built = items.map(buildItem);
  return {
    track: createElement('ul', { className: 'logo-wall-track' }, ...built.map(({ li }) => li)),
    loads: built.map(({ load }) => load),
  };
};

// Placeholders fetch in parallel with icon loads. cloneNode waits until
// both settle so the duplicate track isn't empty spans.
const startMarquee = async (el, viewport, { track, loads }) => {
  const [pause, play] = await Promise.all([
    getPlaceholder('logoWallPause', 'Pause'),
    getPlaceholder('logoWallPlay', 'Play'),
    Promise.all(loads),
  ]);
  const clone = track.cloneNode(true);
  clone.ariaHidden = true;
  viewport.append(clone);
  viewport.classList.add('is-animating');
  addPauseToggle(el, viewport, { className: 'logo-wall-toggle', labels: { pause, play } });
};

export default async (el) => {
  // Guard before the first await so a concurrent decorate() bails instead
  // of racing icon loads / placeholder fetches (see side-by-side.js).
  if (el.dataset.logoWall) return;
  el.dataset.logoWall = 'true';

  const items = extractItems(el);
  el.replaceChildren();
  if (!items.length) return;

  const wall = buildTrack(items);
  const viewport = createElement('div', { className: 'logo-wall-viewport' }, wall.track);
  el.append(viewport);
  if (shouldAnimate()) await startMarquee(el, viewport, wall);
};
