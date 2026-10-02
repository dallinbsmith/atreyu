# Releasing

Code, content and the Worker ship independently.

| What | How it goes live | Rollback |
|---|---|---|
| Code (`blocks/`, `scripts/`, `styles/`, `head.html`, ...) | Merge the PR to `main`. EDS serves `main` at `main--atreyu--dallinbsmith.aem.page` / `.aem.live` within minutes; there is no build or deploy step | Revert the commit and merge the revert |
| Content (pages, fragments, sheets) | Edit in DA → **Preview** (`aem.page`) → **Publish** (`aem.live`) | Restore a previous version in DA, then publish again |
| Worker (`workers/website/`) | Manual `wrangler deploy` after merge, owner approval required | See [worker.md → Rollback](worker.md#rollback) |

## Code release checklist

1. PR approved, "Lint and Test" green, branch up to date with `main` (required by branch protection).
2. Checked on the branch preview (`{branch}--atreyu--dallinbsmith.aem.page`), and a Test URL is present in the PR description when visible pages changed so AEM Code Sync can run its built-in PSI check.
3. If the change alters a block's authored shape, existing DA pages and the Library example are updated in the same release window. A block that expects new rows breaks pages still using the old shape.
4. If the change needs new placeholders (UI strings), the `system/placeholders/<namespace>` sheet rows are published before or with the merge. Code falls back to its English default if a key is missing.
5. Merge. Spot-check the affected pages on `main--atreyu--dallinbsmith.aem.live`.

## Content release notes

- Previewing a sheet (redirects, placeholders, metadata, query index config) is required before publishing it; both steps are done in DA.
- `/drafts/` and `/langstore/` content is never served by the Worker.
- Experiment variant pages under `/v/` must be published for the test to run on `aem.live`.

## No release yet reaches frame.io

The Worker is not in front of frame.io. Until it is, `aem.live` is the furthest any release goes. See [status.md](../status.md#worker-and-routing).
