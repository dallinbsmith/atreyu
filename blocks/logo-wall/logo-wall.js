import { shouldAnimate, addPauseToggle } from '../../scripts/utils/motion/motion.js';
import { buildAccessibleLogo } from '../../scripts/utils/partner-logo.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

// Authoring: one partner/brand per row — either plain text, or a link (href
// = partner site, text = name). Matches Falkor's real LogoWall module (an
// auto-scrolling marquee) but fails open to a static, non-animating,
// non-duplicated list under reduced motion / low-power devices.

const buildItem = ({ name, href }, loads) => {
  const wrapper = document.createElement(href ? 'a' : 'span');
  if (href) wrapper.href = href;
  wrapper.className = 'logo-wall-item';

  const { icon, label, load } = buildAccessibleLogo(name, 32);
  icon.classList.add('logo-wall-icon');
  loads.push(load);

  wrapper.append(icon, label);
  const li = document.createElement('li');
  li.append(wrapper);
  return li;
};

// Returns [track, loadPromises] — callers that need the icons already
// populated (e.g. before cloning) can await Promise.all(loadPromises) first.
const buildTrack = (items) => {
  const loads = [];
  const track = document.createElement('ul');
  track.className = 'logo-wall-track';
  items.forEach((item) => track.append(buildItem(item, loads)));
  return [track, loads];
};

export default async (el) => {
  const items = [...el.querySelectorAll(':scope > div')]
    .map((row) => {
      const link = row.querySelector('a');
      return {
        name: (link?.textContent ?? row.textContent).trim(),
        href: link?.href ?? '',
      };
    })
    .filter(({ name }) => name);

  el.replaceChildren();
  if (!items.length) return;

  const viewport = document.createElement('div');
  viewport.className = 'logo-wall-viewport';
  const [track, loads] = buildTrack(items);
  viewport.append(track);
  el.append(viewport);

  if (shouldAnimate()) {
    // Wait for real icon content before cloning — cloning first would just
    // duplicate empty (still-loading) icon spans, since loadPartnerLogo's
    // fetch hasn't resolved yet at this point in the synchronous build.
    const [, pause, play] = await Promise.all([
      Promise.all(loads),
      getPlaceholder('logoWallPause', 'Pause'),
      getPlaceholder('logoWallPlay', 'Play'),
    ]);
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    viewport.append(clone);
    viewport.classList.add('is-animating');
    addPauseToggle(el, viewport, { className: 'logo-wall-toggle', labels: { pause, play } });
  }
};
