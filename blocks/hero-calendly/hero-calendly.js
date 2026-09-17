// Hero variant: inline embedded Calendly scheduling widget beside foreground
// text content. Ported from Falkor's real HeroCalendlyForm/CalendlyForm
// (web/src/components/organisms/modules/HeroCalendlyForm) — same brand
// colors and inline-widget-init approach, not rebuilt from scratch.
// Author provides text content rows plus one link to a calendly.com URL —
// that link's cell should contain the URL only; any other text sharing the
// cell is dropped along with it, matching the tile-wall/hero cell-grouping
// convention elsewhere in this block family.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { createElement, getCells, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import loadScript from '../../scripts/utils/script.js';
import log from '../../scripts/utils/error.js';
import { isAllowedEmbedHost } from '../../scripts/utils/security/embed-allowlist.js';

const WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js';

// Hex values must match --color-cobalt / --color-light / --color-dark in
// styles.css — Calendly's embed URL needs a literal hex string, not a CSS
// custom property, so these can't be read live from the cascade (the same
// cross-boundary tradeoff already accepted for breakpoints.js).
const THEMES = {
  dark: { background: '000000', text: 'fcfcfc', primary: '5b53ff' },
  light: { background: 'fcfcfc', text: '000000', primary: '5b53ff' },
};

const showFallback = async (widget) => {
  widget.textContent = await getPlaceholder(
    'heroCalendlyUnavailable',
    'This scheduling widget is not available right now.',
  );
};

export default async (el) => {
  if (!guardDecorate(el, 'heroCalendlyDecorated')) return;

  const cells = getCells(el);
  const linkCell = cells.find((c) => c.querySelector('a[href*="calendly.com"]'));
  const textCells = cells.filter((c) => c !== linkCell);

  const content = createElement('div', { className: 'hero-calendly-content' }, ...textCells);
  decorateRichText(content);
  content.querySelector(HEADING_SELECTOR)?.classList.add('hero-calendly-heading');

  const widget = createElement('div', { className: 'hero-calendly-widget' });
  el.replaceChildren(content, widget);

  const link = linkCell?.querySelector('a[href*="calendly.com"]');
  if (!link || !isAllowedEmbedHost(link.href)) {
    await showFallback(widget);
    return;
  }

  try {
    await loadScript(WIDGET_SRC);
    if (!window.Calendly?.initInlineWidget) throw new Error('Calendly script did not initialize');
    // Subtree discarded (e.g. a Quick Edit re-render) while the script loaded.
    if (!widget.isConnected) return;

    const theme = THEMES[el.classList.contains('light') ? 'light' : 'dark'];
    const url = new URL(link.href);
    url.searchParams.set('hide_gdpr_banner', '1');
    url.searchParams.set('background_color', theme.background);
    url.searchParams.set('text_color', theme.text);
    url.searchParams.set('primary_color', theme.primary);

    window.Calendly.initInlineWidget({ url: url.toString(), parentElement: widget });
  } catch (ex) {
    log(ex, el);
    await showFallback(widget);
  }
};
