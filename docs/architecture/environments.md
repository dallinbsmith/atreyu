# Environments

Atreyu uses one EDS site and three tiers. See [ADR 0019](../decisions/0019-environments.md).

## Owner placeholder

`<owner>` is the GitHub or aem.live owner segment in EDS hostnames. It is currently `dallinbsmith`. It changes when the repository moves to the company GitHub org.

## Tiers

| Tier | Purpose | Code | Content | Edge | Host | Code writers | Content writers | Tier value | Debug surface | Analytics | Robots |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dev | Build and review one change. Preview draft content. | Any branch, or local files through `aem up`. | Preview partition. | None, or local Worker dev. | `localhost`; `https://{branch}--atreyu--<owner>.aem.page/<path>` | Contributors with repo write access. | Contributors with DA path access. | `dev` on localhost, `stage` on EDS branch hosts. | On. Authoring tools only on authoring hosts. | Off: Segment requires prod and a real key. | EDS noindex on platform hosts. |
| stage | Rehearse Worker releases, routing cells, consent, analytics, and published content. | `main`. | Live partition. Published content only. | Staging Worker. | A dedicated staging host (planned). | Protected PR merge to `main`. | Publishers. | `stage`. | On for QA, except authoring tools stay authoring-host only. | Off today: custom staging hosts classify as prod until the planned Worker signal, and Segment also requires a real key. | Noindex and `Disallow: /` planned in the Worker. |
| prod | Serve visitors. | `main`. | Live partition. Published content only. | Production Worker. | `https://frame.io/` | Protected PR merge to `main`. | Publishers. | `prod`. | Off. | Production destination after consent and a real key. | Indexable, except system paths. |

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

Today `scripts/utils/env.js` classifies only hostnames:

| Host | Today | Planned Worker tier signal |
|---|---|---|
| `localhost:3000`, `localhost:8787`, `127.0.0.1:3000`, `[::1]:3000` | `dev`. | `dev`. |
| `{branch}--atreyu--<owner>.aem.page` | `stage`. | `stage`; EDS host pattern wins. |
| `main--atreyu--<owner>.aem.live` | `stage`. | `stage`; EDS host pattern wins. |
| `*.hlx.page`, `*.hlx.live`, `*.aem.reviews`, `*.local` | `prod` (fail closed). | `prod` unless the host also gets a Worker-set signal. |
| Worker staging on `workers.dev` | `prod`, because the host has no EDS branch marker. | A Worker-set attribute on `<html>` that authors cannot create says `stage`. Until that Worker and client change lands together, it is `prod`. Missing signals fail closed to `prod`. |
| Dedicated staging host | `prod`, because the host has no EDS branch marker. | A Worker-set attribute on `<html>` that authors cannot create says `stage`. Until that Worker and client change lands together, it is `prod`. Missing signals fail closed to `prod`. |
| `frame.io` | `prod`. | A Worker-set attribute on `<html>` that authors cannot create says `prod`. Missing signals are still `prod`. |

Do not use page or bulk metadata for tier: authors can create metadata. The future custom-host signal must be set by the Worker on `<html>` and read by the client in the same change.

Segment has its own gate: it loads only on prod, only after analytics consent, and only when a real write key replaces the placeholder. Stage/dev traffic must not reach the prod Segment source.

## What staging can and cannot prove

Staging can prove Worker behaviour, routing, consent, analytics destinations, cache behaviour, and published content. It cannot show unpublished DA content through the Worker. It cannot test unmerged site code unless a future per-ref staging host is added.
