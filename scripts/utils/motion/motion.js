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
// labels default to English rather than fetching a placeholder itself — this
// is a shared, dependency-free utility (scripts/utils/*.js don't import from
// blocks or reach into config/content), not a page. A caller that already
// has locale-aware content (e.g. via scripts/utils/placeholders.js) passes
// its own strings through; callers that don't just get the default.
// onToggle(paused), if given, fires synchronously from the same click handler
// that flips the class/label/aria state — a caller needing a side effect tied
// to the toggle (e.g. actually pausing a <video>, not just a CSS animation)
// should use this rather than adding a second listener on the returned button
// and re-reading its class, which only works by accident of registration order.
export const addPauseToggle = (container, animatedEl, {
  className = 'motion-pause-toggle', pauseClass = 'is-paused', labels = { pause: 'Pause', play: 'Play' }, onToggle,
} = {}) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-pressed', 'false');
  button.textContent = labels.pause;
  button.addEventListener('click', () => {
    const paused = animatedEl.classList.toggle(pauseClass);
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? labels.play : labels.pause;
    onToggle?.(paused);
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
