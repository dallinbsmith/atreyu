// Disposable addEventListener session. One AbortController drops every
// listener in the group without the caller holding identities — the same
// cleanup-function convention as trapFocus(), implemented once so overlays
// that stay in the DOM can bind/unbind while the host node lives. Modals
// that `remove()` themselves don't need this; the node teardown is the
// cleanup (see modal.js).

export const listenGroup = () => {
  const ac = new AbortController();
  return {
    listen: (target, type, handler, opts) => {
      target.addEventListener(type, handler, { ...opts, signal: ac.signal });
    },
    end: () => ac.abort(),
  };
};
