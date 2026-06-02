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

// Behavioral marks (/widgets/{name} links) are handled centrally by the
// scripts/behaviors.js registry: ak.js tags them, the phase runners init them.

export default (el) => {
  const content = el.querySelector(':scope > div > div') ?? el;
  content.classList.add('rich-text-content');

  const textNodes = [];
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n);
  textNodes.forEach(styleTextNode);
};
