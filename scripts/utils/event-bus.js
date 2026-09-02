const ns = (name) => `atreyu:${name}`;

const wrap = (handler) => (e) => handler(e.detail);

// Keyed by name first, handler second — a flat WeakMap<handler, wrapped> would
// collide when the same handler function subscribes to more than one event
// name (or re-registers for the same name), leaking or double-firing listeners.
const handlers = new Map();

export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(ns(name), { detail }));

export const off = (name, handler) => {
  const wrapped = handlers.get(name)?.get(handler) ?? handler;
  document.removeEventListener(ns(name), wrapped);
};

export const on = (name, handler) => {
  const wrapped = wrap(handler);
  if (!handlers.has(name)) handlers.set(name, new WeakMap());
  handlers.get(name).set(handler, wrapped);
  document.addEventListener(ns(name), wrapped);
  return () => off(name, handler);
};
