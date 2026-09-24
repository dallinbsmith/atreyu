import { DA_ORIGIN } from './sources.js';

export const readSelection = (port, timeoutMs = 3000) => {
  const { promise, resolve } = Promise.withResolvers();
  const onMessage = (e) => {
    if (e.origin === DA_ORIGIN && e.source === window.parent && e.data?.action === 'sendSelection') resolve(e.data.details);
  };
  const onPortMessage = (e) => (e.data?.action === 'error' ? resolve(null) : null);
  window.addEventListener('message', onMessage);
  port.addEventListener('message', onPortMessage);
  port.start();
  port.postMessage({ action: 'getSelection' });
  const timer = setTimeout(() => resolve(null), timeoutMs);
  return promise.finally(() => {
    clearTimeout(timer);
    window.removeEventListener('message', onMessage);
    port.removeEventListener('message', onPortMessage);
  });
};

export const sendHtml = (port, html) => port.postMessage({ action: 'sendHTML', details: html });
