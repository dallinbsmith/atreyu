import { getConfig } from '../ak.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const XLINKNS = 'http://www.w3.org/1999/xlink';
const { codeBase } = getConfig();

export default (icons) => {
  for (const icon of icons) {
    const name = icon.classList[1].substring(5);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.className = icon.className;
    const use = document.createElementNS(SVGNS, 'use');
    use.setAttributeNS(XLINKNS, 'href', `${codeBase}/icons/${name}.svg#${name}`);
    svg.append(use);
    icon.insertAdjacentElement('afterend', svg);
    icon.remove();
  }
};
