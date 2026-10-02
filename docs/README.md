# Atreyu documentation

Atreyu is Frame.io's marketing site rebuilt on Adobe Edge Delivery Services (EDS), with content in DA (da.live) and a Cloudflare Worker that moves traffic from the existing site to EDS one URL group at a time. It is not serving frame.io yet; see [status.md](status.md).

Everything you need to work on this repo is in this folder. If a doc and the code disagree, the code wins; fix the doc in the same PR.

## Start here

1. Get access (below).
2. New contributor? Follow [runbooks/onboarding.md](runbooks/onboarding.md).
3. Run the site: [runbooks/local-development.md](runbooks/local-development.md).
4. Read [architecture/overview.md](architecture/overview.md), then the conventions for what you'll touch.
5. Read [CONTRIBUTING.md](../CONTRIBUTING.md) and the [definition of done](contributing/definition-of-done.md) before your first PR.

### Access checklist

| Access | Needed for | Notes |
|---|---|---|
| GitHub `dallinbsmith/atreyu` (write) | Branches and PRs | Personal repository until a Frame.io org repository exists |
| DA org `dallinbsmith/atreyu` | Editing and publishing content, the block Library, sheets | Sandbox org; content is not on a Frame.io-owned org yet |
| AEM Sidekick browser extension | Preview/publish from pages, experiments panel | |
| Cloudflare account | Deploying the Worker | Not provisioned for the team yet; local `wrangler dev` needs no account |
| Sanity read token | Running `tools/locale-extractor` against the current site's content | Only for locale migration work |

## Map

| Folder | What's in it |
|---|---|
| [status.md](status.md) | What's built, in progress, blocked and planned, per workstream |
| [architecture/](architecture/) | How it works: [overview](architecture/overview.md), [environments](architecture/environments.md), [Worker](architecture/worker.md), [locales](architecture/locale.md), [personalization](architecture/personalization.md) |
| [authoring/](authoring/) | The content side: [DA structure](authoring/da-content-structure.md), [block catalog](authoring/block-catalog.md), [Section Metadata](authoring/section-metadata.md), [personalization](authoring/personalization.md) |
| [conventions/](conventions/README.md) | Coding rules: [JavaScript](conventions/javascript.md), [CSS](conventions/css.md), [blocks](conventions/blocks.md), [Worker](conventions/workers.md), [testing](conventions/testing.md), [accessibility](conventions/accessibility.md), [assets](conventions/assets.md) |
| [runbooks/](runbooks/) | Step by step: [onboarding](runbooks/onboarding.md), [local development](runbooks/local-development.md), [Worker dev/deploy/rollback](runbooks/worker.md), [releasing](runbooks/releasing.md) |
| [decisions/](decisions/README.md) | Decision records, open questions, and a map from old decision IDs |
| [contributing/](contributing/definition-of-done.md) | The project definition of done |

Also at the repository root: [AGENTS.md](../AGENTS.md) (instructions for AI coding agents), [CONTRIBUTING.md](../CONTRIBUTING.md), `scripts/AK-PATCHES.md` (every change to author-kit core files), `experiments-panel/README.md`, `widgets/README.md`.

## Terms

| Term | Meaning |
|---|---|
| EDS | AEM Edge Delivery Services. Serves this repo's code and DA content from `*.aem.page` (preview) and `*.aem.live` (published) |
| DA | Document Authoring (da.live), where content is edited |
| Existing site | The current frame.io (Next.js + Sanity), reached by the Worker through `LEGACY_ORIGIN` |
| Block | A content unit authored as a table in DA and implemented in `blocks/{name}/` |
| Cohort | A named group of URL prefixes that move to EDS together |
| Cell | A `{ cohort, locale }` pair that the Worker sends to EDS |
| E-L-D | Eager, Lazy, Delayed: the three page-loading phases |
| ak.js | The author-kit core loader, `scripts/ak.js` |
