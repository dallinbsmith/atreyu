# Environments

Atreyu uses one EDS site and three tiers. See [ADR 0019](../decisions/0019-environments.md).

## Owner placeholder

`<owner>` is the GitHub or aem.live owner segment in EDS hostnames. It is currently `dallinbsmith`. It changes when the repository moves to the company GitHub org.

## Tiers

| Tier | Purpose | Code | Content | Edge | Host | Code writers | Content writers | Tier value | Debug surface | Analytics | Robots |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dev | Build and review one change. Preview draft content. | Any branch, or local files through `aem up`. | Preview partition. | None, or local Worker dev. | `localhost`; `https://{branch}--atreyu--<owner>.aem.page/<path>` | Contributors with repo write access. | Contributors with DA path access. | `dev` on localhost, `stage` on EDS branch hosts. | On. Authoring tools only on authoring hosts. | Off: Segment requires prod and a real key. | EDS noindex on platform hosts. |
| stage | Rehearse Worker releases, routing cells, consent, analytics, and published content. | `main`. | Live partition. Published content only. | Staging Worker. | A dedicated staging host (planned). | Protected PR merge to `main`. | Publishers. | `stage` (Worker `DEPLOY_TIER`). | On for QA, except authoring tools stay authoring-host only. | Off: Segment requires prod and a real key. | Worker sends `x-robots-tag: noindex, nofollow` on every response and a `Disallow: /` `robots.txt`. |
| prod | Serve visitors. | `main`. | Live partition. Published content only. | Production Worker. | `https://frame.io/` | Protected PR merge to `main`. | Publishers. | `prod` (Worker `DEPLOY_TIER`). | Off. | Production destination after consent and a real key. | Indexable, except system paths. |

Merge to `main` updates `main--atreyu--<owner>.aem.live` within minutes. The code gate is the PR. Staging is not an unreleased-code tier.

## Switches and URL parameters

| Switch | Kind | Where it applies | Gate |
|---|---|---|---|
| `EDS_DISABLED` | Operational kill switch | Worker | Sends routed traffic to the existing site. Not a tier. |
| Planned per-locale cell switch | Operational kill switch | Worker | Planned switch passed to `createIsEdsPath` to disable selected locale cells. Not a tier. |
| `?dapreview` | Authoring tool | Authoring hosts only | `isAuthoringPreviewAllowed`. |
| `?quick-edit` | Authoring tool | Authoring hosts only | `isAuthoringPreviewAllowed`. |
| `?experiment=` | QA and preview | Every host | Allowed everywhere. Forced runs send no Segment exposure; RUM checkpoints from the vendored plugin still fire. |
| `?audience=` | QA and preview | Every host | Allowed everywhere. Forced runs send no Segment exposure; RUM checkpoints from the vendored plugin still fire. |
| `?schedule=` | QA and preview | Non-production tier | `env.js` tier. |
| `?rum` | Diagnostics | Any host where the RUM script supports it | RUM runtime. |

New parameters must name their gate in the PR.

## Host classification

`scripts/utils/env.js` classifies in this order:

1. Loopback is `dev`.
2. An Adobe EDS host (`*--*--*.aem.page` or `*--*--*.aem.live`) is `stage`. The tier attribute is ignored.
3. Any other host uses `<html data-deploy-tier>` when it is `dev`, `stage` or `prod`. The Worker sets it from `DEPLOY_TIER` on EDS HTML and removes any upstream value.
4. Otherwise `prod` (fail closed).

| Host | Tier |
|---|---|
| `localhost:3000`, `localhost:8787`, `127.0.0.1:3000`, `[::1]:3000` | `dev`. |
| `{branch}--atreyu--<owner>.aem.page` | `stage`. |
| `main--atreyu--<owner>.aem.live` | `stage`. |
| `*.hlx.page`, `*.hlx.live`, `*.aem.reviews`, `*.local` | `prod`: no Worker sets the attribute there. |
| Staging Worker (`workers.dev` today, a dedicated staging host later) | `stage`, from the Worker attribute. Missing or invalid: `prod`. |
| `frame.io` (production Worker) | `prod`, from the Worker attribute. Missing or invalid: still `prod`. |

The tier is never read from page or bulk metadata, or from any `<meta>`: authors can create those. Only the Worker can set the `<html>` attribute. Worker details: [worker.md](worker.md#deploy-tier).

Segment has its own gate: it loads only on prod, only after analytics consent, and only when a real write key replaces the placeholder. Stage/dev traffic must not reach the prod Segment source.

## What staging can and cannot prove

Staging can prove Worker behaviour, routing, consent, analytics destinations, cache behaviour, and published content. It cannot show unpublished DA content through the Worker. It cannot test unmerged site code unless a future per-ref staging host is added.
