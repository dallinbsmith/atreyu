# Contributing

Read [docs/README.md](docs/README.md) first. Coding rules are in [docs/conventions/](docs/conventions/README.md).

## Branches and pull requests

1. Branch from `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`. Keep a branch to one change.
2. `npm install` once per clone. It sets `core.hooksPath` to `.githooks`, so a pre-commit hook runs ESLint on your staged `.js` files.
3. Before pushing: `npm run lint` and `npm test` pass. Check visual changes in a browser.
4. Push and open a PR against `main`. Fill in the PR template (`.github/PULL_REQUEST_TEMPLATE.md`); if a checklist item doesn't apply, say so rather than deleting it.
5. Share the branch preview, `https://{branch}--atreyu--dallinbsmith.aem.page/{path}`, for anything visible.
6. Merge when approved and green. The PR merging to `main` is the release for code ([docs/runbooks/releasing.md](docs/runbooks/releasing.md)).

Commit messages: imperative summary line (`Fix carousel focus trap`), body explaining why when it isn't obvious.

## Required checks

Branch protection on `main` requires the **Lint and Test** check (`.github/workflows/ci.yml`) to pass, the branch to be up to date with `main`, and every review conversation to be resolved. It applies to admins too.

- When a PR touches no code paths (for example docs only), the job skips its steps and still reports success.
- Lighthouse CI runs on PRs that touch blocks, scripts, styles, `head.html` or the Worker. It isn't required, but look at regressions.
- After the full suite (which runs in UTC), CI always runs the date-sensitive suites again with `TZ=America/Los_Angeles` ([conventions/testing.md](docs/conventions/testing.md)). A failure in either run fails the job; it is not a retry.

## Review

| Change | Needs |
|---|---|
| Anything | One approving review from a project engineer |
| `workers/**` | Approval from the repository owner (`@dallinbsmith`) |
| A new routing cell in `workers/website/routing-manifest.js` | Two engineering reviews plus the owner's approval |
| `scripts/ak.js`, `scripts/lazy.js`, `scripts/postlcp.js` | A matching row in `scripts/AK-PATCHES.md` in the same PR |
| A block's authored shape (rows, columns, variant tokens) | The DA Library example and existing content updated in the same release; renames of stable blocks need a decision record ([0016](docs/decisions/0016-block-names-are-a-contract.md)) |
| `plugins/experimentation/` | Don't edit. It is vendored from Adobe; upgrade it as a whole |
| A new decision | A record in `docs/decisions/` |

`.github/CODEOWNERS` requests the owner's review automatically. GitHub does not currently enforce a review count or code-owner approval on `main`; the table above is the rule regardless.

Reviewers check correctness against the conventions, tests for new behaviour, and that docs changed with the code. A PR that changes behaviour described in `docs/` updates the doc in the same PR.

## The AK-PATCHES rule

`scripts/ak.js`, `scripts/lazy.js` and `scripts/postlcp.js` come from Adobe's author-kit. Every local change gets a row in `scripts/AK-PATCHES.md` (what, why, classification), so upstream updates can be taken safely ([0004](docs/decisions/0004-author-kit-with-recorded-patches.md)). Put project logic in `scripts/utils/` or `scripts/scripts.js` instead when you can.

## Docs

- Docs live in `docs/`. Verify every claim against the code; name files and symbols that exist.
- Don't link to anything outside this repository that a contributor can't open.
