const callbacks = new WeakMap();

const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      io.unobserve(entry.target);
      callbacks.get(entry.target)?.(entry.target);
      callbacks.delete(entry.target);
    }
  }
});

export default (el, callback) => {
  callbacks.set(el, callback);
  io.observe(el);
};
