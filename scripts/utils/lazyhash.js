(async () => {
  const id = localStorage.getItem('lazyhash');
  if (!id) return;
  localStorage.removeItem('lazyhash');
  document.getElementById(id)?.scrollIntoView();
})();
