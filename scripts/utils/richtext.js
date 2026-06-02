// Inline custom-style convention: [[style|text]] → <span class="rt-style">text</span>
// (DOM-built, no innerHTML — approximates Portable Text decorators on the EDS richtext field)
const STYLE_RE = /\[\[([\w-]+)\|([^\]]+)\]\]/;

const styleTextNode = (start) => {
  let node = start;
  let match = node.nodeValue.match(STYLE_RE);
  while (match) {
    const [full, name, content] = match;
    const tail = node.splitText(match.index);
    tail.nodeValue = tail.nodeValue.slice(full.length);
    const span = document.createElement('span');
    span.className = `rt-${name}`;
    span.textContent = content;
    tail.before(span);
    node = tail;
    match = node.nodeValue.match(STYLE_RE);
  }
};

// Walks the text nodes within an explicit scope and applies the [[style|text]]
// decorator. Scope is required — never assumes document root or a fixed
// `:scope > div > div` shape, so any block can reuse it on its own regions.
export const decorateRichText = (scope) => {
  if (!scope) return;
  const textNodes = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n);
  textNodes.forEach(styleTextNode);
};
