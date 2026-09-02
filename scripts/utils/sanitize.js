// Strips script-execution vectors from an HTML/SVG string before it is ever
// attached to the live document. DOMParser alone is NOT a sanitizer: it will
// not execute a parsed <script>, but inline event-handler attributes
// (onerror, onload, onclick...) on the parsed-but-detached nodes WILL fire
// once those nodes are appended to a live document. So parsing happens into
// an inert document first, then every dangerous tag/attribute is explicitly
// removed, and only after that is anything moved into the real DOM.
const DANGEROUS_TAGS = 'script, style, iframe, object, embed, link';
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'formaction']);
// Security-audit fix, 2026-09-02: this was previously built via
// ['java', 'script:'].join('') to dodge a `no-script-url` lint false-positive,
// but that made the literal ungrep-able for a human reviewer auditing this
// sanitizer's coverage. Written as a literal + scoped suppression instead —
// grep-able, still lint-clean.
// eslint-disable-next-line no-script-url -- sanitizer comparing, not a sink
const SCRIPT_SCHEME = 'javascript:';

// Browsers strip ASCII tab/newline/CR from a URL scheme before navigating
// (WHATWG URL spec's "C0 control or space" trimming), so `jav\tascript:` still
// executes as `javascript:` even though a plain .trim() (which only strips
// leading/trailing whitespace, not embedded characters) would miss it.
const stripControlChars = (value) => value.replace(/[\t\n\r]/g, '');

const stripNode = (el) => {
  [...el.attributes].forEach(({ name, value }) => {
    const lower = name.toLowerCase();
    const normalizedValue = stripControlChars(value.trim().toLowerCase());
    if (lower.startsWith('on')) el.removeAttribute(name);
    if (URL_ATTRS.has(lower) && normalizedValue.startsWith(SCRIPT_SCHEME)) el.removeAttribute(name);
  });
};

// Returns a sanitized, still-detached DocumentFragment-like root (a <body>
// or <svg> element) — caller is responsible for moving its children into
// the live DOM (e.g. via replaceChildren/append), never via innerHTML.
export const sanitizeMarkup = (markup) => {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  doc.body.querySelectorAll(DANGEROUS_TAGS).forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach(stripNode);
  return doc.body;
};
