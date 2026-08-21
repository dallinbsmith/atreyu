/**
 * Platform-domain markers — is a given hostname part of this project's own
 * AEM/DA/EDS platform (vs. a genuinely external link)?
 *
 * AUTHORITATIVE single source for this specific question. Split out of
 * blocks/fragment/fragment.js during the P0-48 config-drift-guard follow-up,
 * after a reviewer flagged that file's inline
 * `['.da.', '.aem.', 'local'].some((host) => hostname.includes(host))` as
 * worth a second look, since `'local'` overlaps textually with
 * scripts/utils/env.js's vocabulary.
 *
 * Decision: this stays separate from env.js, it does not get folded in.
 * env.js answers "which deploy tier is the CURRENT page running in"
 * (prod/stage/dev) — a property of this page's own hostname. This file
 * answers a different question: "does THIS OTHER hostname (from a link's
 * href) belong to the AEM/DA platform family at all," regardless of which
 * tier either side is on — used by fragment.js to decide whether a
 * fragment link is same-site (and should be treated as a relative path)
 * or a truly external URL. The two questions are independent: a link could
 * point at a same-platform hostname on a different tier than the current
 * page, or an external hostname while the current page is itself on
 * 'local'. Merging them would conflate two unrelated classification axes
 * just because they happen to share the substring 'local'.
 */
export const PLATFORM_HOST_MARKERS = ['.da.', '.aem.', 'local'];

/** True if `hostname` looks like it belongs to the AEM/DA platform family. */
export const isPlatformHost = (hostname) => PLATFORM_HOST_MARKERS
  .some((marker) => hostname.includes(marker));
