const ns = (name) => `atreyu:${name}`;

const wrap = (handler) => (e) => handler(e.detail);

const handlers = new WeakMap();

export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(ns(name), { detail }));

export const off = (name, handler) => {
  const wrapped = handlers.get(handler) ?? handler;
  document.removeEventListener(ns(name), wrapped);
};

export const on = (name, handler) => {
  const wrapped = wrap(handler);
  handlers.set(handler, wrapped);
  document.addEventListener(ns(name), wrapped);
  return () => off(name, handler);
};
