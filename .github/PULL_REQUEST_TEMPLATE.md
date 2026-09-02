<!--
Every item below is here because this exact bug class was found — most of
them more than once, independently — during real hardening passes on this
repo. This isn't a generic best-practices list; it's this project's own
mistake history turned into a checklist. If a section doesn't apply to your
change, say so rather than deleting it — that's still useful signal.

What's already automated (you don't need to manually check these — CI/lint
does): duplicate locale/env config, block CSS not wrapped in `@layer blocks`,
blocks importing from scripts/utils/ in the wrong direction, blocks over the
100-line limit, ESLint/Stylelint rules generally. Everything below this line
is NOT currently automated — it depends on you actually checking.
-->

## What changed and why

<!-- One or two sentences. Link the artifacts/ or memory doc if this traces back to a real decision. -->

## Checklist

### Caching & async correctness
- [ ] No cache stores a failed/empty/null result indistinguishably from a real success. (Found 3 times independently — `fetch-data.js`, `icons.js`, `placeholders.js` — before all three were fixed to delete/skip the cache entry on failure so a later call retries.)
- [ ] Every new `fetch()` has a timeout (`AbortSignal.timeout()` in browser code; a manual `AbortController` + `clearTimeout` in Worker code specifically, per `workers/website/handlers/aem.js`/`redirects.js` — Worker instances are more resource-constrained, so early cancellation matters there in a way it doesn't in a browser tab) and a defined fail-open/fail-closed behavior, not an unbounded wait.
- [ ] No Worker code reads or writes visitor-specific data (IP, resolved segment, cookie value) to a module-level binding — Cloudflare reuses Worker instances across requests from different visitors. Shared *config* caches (like `redirects.js`'s TTL cache) are fine; visitor data is not.

### DOM & performance
- [ ] No loop reads a layout property (`getBoundingClientRect`, `offsetWidth`, etc.) and writes a style in the same iteration across multiple elements — read everything first, then write everything, or you get forced synchronous layout. (Found in `scroll.js`'s shared scroll-progress engine.)
- [ ] Any high-frequency event handler (`mousemove`, `scroll`, `resize`) coalesces to `requestAnimationFrame`, not one style write per raw event. (Found in `quote-hover.js`.)
- [ ] If a function returns a cleanup/unsubscribe handle (an `IntersectionObserver.disconnect()`, an event listener remover), either call it somewhere real or leave a comment explaining why discarding it is currently safe — don't just drop it silently.

### Content & copy
- [ ] No hardcoded user-facing English string in block/utility JS (button labels, ARIA announcements, badge text) — route it through `getPlaceholder(key, fallback)`. (Found in `logo-wall.js`, `pricing.js`, `jsonld.js`'s breadcrumb label.)
- [ ] No hardcoded color, spacing, or radius value that duplicates an existing design token — reference the token instead. Stylelint's `color-no-hex` catches literal hex colors; it does not catch duplicated `rgb()`/spacing values, so this still needs an eyeball check.

### Security
- [ ] Any new sanitizer, allowlist, or auth-adjacent logic has real test coverage — `sanitize.js` and `embed-allowlist.js` shipped with zero tests for a full session before this was caught.
- [ ] Any new Worker route doesn't reuse a `Request`/header set that was built for a *different* origin — `dasc.js` once forwarded the AEM-authenticated request's `Authorization` header to an unrelated third-party host this way.
- [ ] Any new redirect/URL-safety check normalizes backslashes before a `startsWith('/') && !startsWith('//')`-style same-origin check — browsers treat a leading `\` as `/`, which bypassed exactly this check once in `redirects.js`.

### Code organization
- [ ] Before writing a new small helper (slugify, clamp, a DOM-builder), grep for one that might already exist — `slugify()` and index-clamping logic were each independently reimplemented twice before being unified.
- [ ] A new asset (icon, image, media file) goes in the right place per `.claude/rules/assets.md`: `icons/{name}.svg` only for author-typed `:iconname:` icons, flat in the block's own folder for block-exclusive fixed media, `img/{category}/` for anything else shared and code-driven.

### Verification (can't be automated — needs an actual human/agent look)
- [ ] Any CSS, animation, or layout change was actually rendered in a real browser, not just reasoned through from the CSS spec. Lint and unit tests verify syntax, not what it looks like.
- [ ] If this touches cascade-layer-sensitive CSS (anything with equal-specificity overrides across `base`/`blocks`/`sections`), the actual visual precedence was checked, not just assumed from the declared layer order.
