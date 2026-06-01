const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = mql.matches;
mql.addEventListener('change', (e) => { reducedMotion = e.matches; });

export const shouldAnimate = () => !reducedMotion
  && !navigator.connection?.saveData
  && (!navigator.connection?.effectiveType || navigator.connection.effectiveType === '4g')
  && navigator.hardwareConcurrency >= 4;

export const getTransitionDuration = (ms) => (shouldAnimate() ? ms : 0);

export const onReveal = (el, callback, options = {}) => {
  if (!shouldAnimate()) {
    callback({ immediate: true });
    return;
  }
  const opts = { threshold: 0, rootMargin: '-25px 0px', ...options };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        callback(entry);
      }
    }
  }, opts);
  observer.observe(el);
};
