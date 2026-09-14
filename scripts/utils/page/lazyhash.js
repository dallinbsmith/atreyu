(async () => {
  const id = localStorage.getItem('lazyhash');
  if (!id) return;
  localStorage.removeItem('lazyhash');
  // CSS.escape (not a plain template literal): unlike getElementById, a
  // querySelector-based lookup throws on a malformed selector — id comes
  // from the URL hash, so it isn't guaranteed to be a valid CSS identifier.
  document.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView();
})();
