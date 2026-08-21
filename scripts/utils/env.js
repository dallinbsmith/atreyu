// Deploy-tier classifier for the CURRENT page's own hostname (prod/stage/
// dev). Not the same question as "does this OTHER hostname belong to the
// AEM/DA platform" — see scripts/utils/platform-host.js for that; the two
// happen to both check for the substring 'local' but answer independent
// questions and are intentionally not consolidated.
export default (() => {
  const { host } = window.location;
  if (!['--', 'local'].some((check) => host.includes(check))) return 'prod';
  if (['--'].some((check) => host.includes(check))) return 'stage';
  return 'dev';
})();
