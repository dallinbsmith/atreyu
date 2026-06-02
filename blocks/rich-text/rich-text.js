import { emit } from '../../scripts/utils/event-bus.js';

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

// Behavioral marks via link-href convention: href /widgets/{name} → data-behavior + event
const decorateBehaviors = (el) => {
  for (const a of el.querySelectorAll('a[href*="/widgets/"]')) {
    const behavior = new URL(a.href, window.location.href).pathname.split('/widgets/')[1];
    if (behavior) {
      a.dataset.behavior = behavior;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        emit(`widget-${behavior}`, { source: a });
      });
    }
  }
};

export default (el) => {
  const content = el.querySelector(':scope > div > div') ?? el;
  content.classList.add('rich-text-content');

  const textNodes = [];
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n);
  textNodes.forEach(styleTextNode);

  decorateBehaviors(content);
};
