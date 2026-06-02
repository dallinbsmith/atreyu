let idCounter = 0;

export const generateId = (prefix = 'a11y') => {
  const id = `${prefix}-${idCounter}`;
  idCounter += 1;
  return id;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const rovingTabindex = (container, items, options = {}) => {
  const { orientation = 'horizontal', wrap = true } = options;
  const elements = [...items];
  if (!elements.length) return () => {};

  const setActive = (index, moveFocus = true) => {
    for (const el of elements) el.setAttribute('tabindex', '-1');
    elements[index].setAttribute('tabindex', '0');
    if (moveFocus) elements[index].focus();
  };

  // Establish roving state without stealing focus on load (only move focus
  // in response to actual keyboard navigation).
  setActive(0, false);

  const prevKeys = orientation === 'horizontal' ? ['ArrowLeft'] : ['ArrowUp'];
  const nextKeys = orientation === 'horizontal' ? ['ArrowRight'] : ['ArrowDown'];

  const onKeydown = (e) => {
    const current = elements.findIndex((el) => el.getAttribute('tabindex') === '0');
    let next;

    if (nextKeys.includes(e.key)) {
      next = current + 1;
      if (next >= elements.length) next = wrap ? 0 : current;
    } else if (prevKeys.includes(e.key)) {
      next = current - 1;
      if (next < 0) next = wrap ? elements.length - 1 : current;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = elements.length - 1;
    }

    if (next != null && next !== current) {
      e.preventDefault();
      setActive(next);
    }
  };

  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
};

export const trapFocus = (container) => {
  const siblings = [...container.parentElement.children].filter((el) => el !== container);
  for (const sib of siblings) sib.setAttribute('inert', '');

  const onKeydown = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = [...container.querySelectorAll(FOCUSABLE)];
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable.at(-1);

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);

  return () => {
    container.removeEventListener('keydown', onKeydown);
    for (const sib of siblings) sib.removeAttribute('inert');
  };
};

let liveRegion;

export const announce = (message, priority = 'polite') => {
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    Object.assign(liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
    });
    document.body.append(liveRegion);
  }

  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = message; }, 100);
};
