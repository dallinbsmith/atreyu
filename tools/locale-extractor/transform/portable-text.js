// Portable Text → DA block-table HTML, scoped to the style/mark vocabulary
// G-2 of locale-extraction-spike-2026-09-25.md found on real Sanity content
// (project s6lu43cv, dataset production-v4). Every mapping below was checked
// against a real authored block (a DA Library doc or a real published page
// snapshot under artifacts/mcp-snapshots/da/), not invented from the Sanity
// schema in isolation. Where no real precedent was found, the TODO comment
// says so explicitly instead of guessing.
//
// Real precedent for `eyebrow`: `[[eyebrow|Camera to Cloud]]` inside a plain
// <p>, confirmed in both a real page (features/c2c.html) and a Library doc
// (text-over-image.html), not a dedicated tag.
const STYLE_TO_TAG = {
  title1: 'h1',
  title2: 'h2',
  title3: 'h3',
  title4: 'h4',
  title5: 'h5',
  title6: 'h6',
  normal: 'p',
  // TODO: no real authored page with a `label`-style block has been found
  // yet. Falling back to <p> is a safe default (content isn't lost), but
  // verify this against real content before a page using `label` migrates.
  label: 'p',
};

const escapeHtml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// `em` and `emWithDash` are two distinct Sanity marks; no real content sample
// surfaced what `emWithDash` should render differently (an em-dash prefix? a
// different emphasis level?). Treating both as <em> keeps content, but this
// needs a real comparison sample before it's trusted blindly.
const MARK_TAGS = { em: 'em', emWithDash: 'em' };

// One Portable Text `span` (a run of text with zero or more marks) → inline
// HTML. `markDefs` carries link targets (href) keyed by the mark's `_key`.
//
// A manual line break in Portable Text is a literal `\n` inside the text
// run. Found live on the ja-jp enterprise page's h1 ("制作ワークフローを\n
// 安全に拡張") while verifying this extractor's own output, a browser
// collapses raw `\n` in HTML, silently eating every intentional line break.
// Real authored content on this site uses explicit `<br>` for this (e.g.
// features/c2c.html's `<h1>Lights.<br>Camera.<br>Cloud.</h1>`), so that's
// the target shape, not a guess.
const renderSpan = (span, markDefs) => {
  // Real content has blocks with an explicit `markDefs: null` (not just
  // omitted), confirmed on the ja-jp pothole wave, the `= []` default param
  // only catches `undefined`, so null needs its own fallback here.
  const defs = markDefs ?? [];
  let html = escapeHtml(span.text ?? '').replaceAll('\n', '<br>');
  for (const mark of span.marks ?? []) {
    const linkDef = defs.find((d) => d._key === mark && d._type === 'link');
    if (linkDef?.href) {
      html = `<a href="${escapeHtml(linkDef.href)}">${html}</a>`;
    } else if (MARK_TAGS[mark]) {
      const tag = MARK_TAGS[mark];
      html = `<${tag}>${html}</${tag}>`;
    }
  }
  return html;
};

// A real authored block (`block.button` / `block.calendlyButton`) carries no
// single confirmed href field across both types, a `phoneNumber`-type
// `block.button` uses `phoneNumberUrl` (confirmed on the real ja-jp enterprise
// page, tel:+81120693682), an `internal`-type one carries a `reference` to
// another Sanity document instead (G-7, resolved via the `resolvedRefs` map
// built by fetch.js's `resolveReferences`), and `block.calendlyButton`'s own
// `button` object had no href/url/reference field at all in the real
// document this was found on. Rather than fabricate a Calendly URL, this
// resolves what it can and flags the rest.
const pushButtonWarnings = (block, button, resolved, href, warnings) => {
  if (resolved?.crossLocale) {
    warnings.push(`CTA "${button?.label ?? '(no label)'}" links to ${resolved.path}, no localized sibling was found for this reference, this sends the visitor out of their locale.`);
  }
  if (!href) {
    const reason = button?.reference?._ref ? `an unresolved internal reference (${button.reference._ref})` : 'no resolvable href';
    warnings.push(`Unresolved CTA href for ${block._type} "${button?.label ?? '(no label)'}" (${reason}), emitting as plain text, not a link.`);
  }
};

const renderButtonBlock = (block, warnings, resolvedRefs) => {
  const { button } = block;
  const label = escapeHtml(button?.label ?? '');
  const resolved = button?.reference?._ref && resolvedRefs.get(button.reference._ref);
  const href = button?.phoneNumberUrl ?? resolved?.path ?? button?.href ?? button?.url ?? null;

  pushButtonWarnings(block, button, resolved, href, warnings);
  return href ? `<a href="${escapeHtml(href)}">${label}</a>` : label;
};

const isButtonBlock = (block) => block._type === 'block.button' || block._type === 'block.calendlyButton';

// Real precedent (hero.js's authoring convention, matching real content like
// features/c2c.html): consecutive CTA buttons share ONE <p>, space-separated
// anchors, rather than one <p> per button.
const groupButtons = (content) => {
  const groups = [];
  for (const block of content) {
    const prev = groups.at(-1);
    if (isButtonBlock(block) && prev?.type === 'buttons') {
      prev.blocks.push(block);
    } else if (isButtonBlock(block)) {
      groups.push({ type: 'buttons', blocks: [block] });
    } else {
      groups.push({ type: 'text', block });
    }
  }
  return groups;
};

// `content` is a Sanity Portable Text array (module.*.content.content, per
// the real heroScreen shape). Returns an array of HTML element strings, one
// per authored paragraph/heading/CTA-group, the caller wraps these in
// whatever row/cell shape the target block expects. `resolvedRefs` (G-7) is
// optional, callers that haven't resolved any references yet (or have none
// to resolve) can omit it and every internal-reference CTA just stays
// flagged-unresolved, same as before G-7 existed. `headingTag` is an
// optional per-caller override for a title-style block's tag, real need
// confirmed by module.bentos: its card heading is style "title6" but
// renders as `<h3>` in real production DA content (features/c2c.html), not
// `<h6>` per the generic mapping below, a bento-card-specific authoring
// convention, not a bug in the shared mapping other callers still rely on.
export const renderPortableText = (
  content,
  warnings = [],
  resolvedRefs = new Map(),
  headingTag = null,
) => {
  if (!content?.length) return [];
  return groupButtons(content).map((group) => {
    if (group.type === 'buttons') {
      const anchors = group.blocks.map((b) => renderButtonBlock(b, warnings, resolvedRefs));
      return `<p>${anchors.join(' ')}</p>`;
    }
    const { block } = group;
    if (block._type !== 'block') {
      warnings.push(`Unhandled Portable Text block type "${block._type}", dropped, not rendered. Add a case for it once real content needing it is found.`);
      return '';
    }
    const text = (block.children ?? []).map((span) => renderSpan(span, block.markDefs)).join('');
    if (block.style === 'eyebrow') return text ? `<p>[[eyebrow|${text}]]</p>` : '';
    const isTitleStyle = block.style?.startsWith('title');
    const tag = (headingTag && isTitleStyle) ? headingTag : (STYLE_TO_TAG[block.style] ?? 'p');
    return text ? `<${tag}>${text}</${tag}>` : '';
  }).filter(Boolean);
};
