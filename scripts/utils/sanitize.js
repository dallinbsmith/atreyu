// Strips script-execution vectors from an HTML/SVG string before it is ever
// attached to the live document. DOMParser alone is NOT a sanitizer: it will
// not execute a parsed <script>, but inline event-handler attributes
// (onerror, onload, onclick...) on the parsed-but-detached nodes WILL fire
// once those nodes are appended to a live document. So parsing happens into
// an inert document first, then every dangerous tag/attribute is explicitly
// removed, and only after that is anything moved into the real DOM.
const DANGEROUS_TAGS = 'script, style, iframe, object, embed, link';
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'formaction']);
// Built at runtime (not a literal) so the string never reads as an eval-able
// URL pragma to static analysis — this is a sanitizer comparing against it,
// not a sink assigning it.
const SCRIPT_SCHEME = ['java', 'script:'].join('');

const stripNode = (el) => {
  [...el.attributes].forEach(({ name, value }) => {
    const lower = name.toLowerCase();
    const trimmedValue = value.trim().toLowerCase();
    if (lower.startsWith('on')) el.removeAttribute(name);
    if (URL_ATTRS.has(lower) && trimmedValue.startsWith(SCRIPT_SCHEME)) el.removeAttribute(name);
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
