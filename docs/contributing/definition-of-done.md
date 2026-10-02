# Definition of done

Use this checklist before asking for final review. If an item does not apply, say so in the PR.

## Universal criteria

- Work is in a PR. Do not commit directly to `main`.
- `npm run lint` passes.
- Relevant tests pass. For broad code changes, run `npm test`.
- The PR template is complete, including Test URLs and evidence.
- Browser console has no new errors on the tested pages.
- The project owner approves the final state, or a named maintainer approves when delegated.
- No new build step, bundler, runtime dependency, third-party script, or persistent service is added without approval.
- Any new URL parameter or environment-dependent behaviour names its gate.
- Any required DA content, sheet, or Library change is ready in the same release window.

## Quality gates for UI changes

Use the PR Test URLs unless the change can only be tested locally.

| Gate | Target |
|---|---|
| Lighthouse mobile Performance | 95 or higher |
| Lighthouse Accessibility | 100 |
| Lighthouse Best Practices | 95 or higher |
| Lighthouse SEO | 100 |
| Largest Contentful Paint | 2.5 s or less |
| Total Blocking Time | 200 ms or less in lab data |
| Interaction to Next Paint | 200 ms or less in field data once live |
| Cumulative Layout Shift | 0.1 or less |
| Eager payload | 100 KB or less for `ak.js`, `scripts.js`, `styles.css`, and first-section code |
| Accessibility | WCAG 2.1 AA; axe has zero critical or serious issues |
| Breakpoints | 768, 1240, and 1440 px checked when layout changes |
| Browsers | Latest Chrome, Safari, Firefox, Edge, iOS Safari, and Android Chrome for high-risk UI changes |

Evidence is PSI from the Test URLs plus a manual Lighthouse mobile run.

## Blocks

- The authored shape is documented in the block catalog or nearby authoring docs.
- Existing content and the DA Library example are updated when rows, columns, or variants change.
- JS and CSS follow the block conventions.
- Re-decoration, teardown, keyboard access, reduced motion, and empty states are checked when relevant.

## Migrated pages

- Page works on the branch preview.
- Links, forms, media, metadata, canonical, headings, and structured data are checked.
- The page has no missing placeholders, broken fragments, or broken images.
- Content owner has reviewed the page when copy or layout changed.

## Redirects

- Source and destination are correct, normalized, and safe.
- Redirect sheets are previewed before publish.
- Important legacy URLs are spot-checked.

## UI strings

- User-facing strings use placeholders, not hardcoded English in JS.
- Placeholder rows are previewed or published before code needs them.
- Fallback text is short and safe.

## Docs

- Links resolve.
- The doc describes shipped behaviour or clearly says planned.
- Public docs contain no secrets, customer data, private operational details, private channels, or unreleased announcements.
