// Decorative vertical spacer — height comes from the size variant in spacer.css
export default (el) => {
  el.setAttribute('aria-hidden', 'true');
  el.replaceChildren();
};
