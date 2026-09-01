const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = mql.matches;
mql.addEventListener('change', (e) => { reducedMotion = e.matches; });

export const shouldAnimate = () => !reducedMotion
  && !navigator.connection?.saveData
  && (!navigator.connection?.effectiveType || navigator.connection.effectiveType === '4g')
  && navigator.hardwareConcurrency >= 4;

export const getTransitionDuration = (ms) => (shouldAnimate() ? ms : 0);

// WCAG 2.2.2 (Pause, Stop, Hide): shouldAnimate() only decides whether
// continuous motion starts — anything that moves for 5+ seconds still needs
// its own user-operable pause control regardless of that check.
export const addPauseToggle = (container, animatedEl, { className = 'motion-pause-toggle', pauseClass = 'is-paused' } = {}) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-pressed', 'false');
  button.textContent = 'Pause';
  button.addEventListener('click', () => {
    const paused = animatedEl.classList.toggle(pauseClass);
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? 'Play' : 'Pause';
  });
  container.append(button);
  return button;
};

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
