# Environments

Atreyu uses one EDS site and three tiers. See [ADR 0019](../decisions/0019-environments.md).

## Owner placeholder

`<owner>` is the GitHub or aem.live owner segment in EDS hostnames. It is currently `dallinbsmith`. It changes when the repository moves to the company GitHub org.

## Tiers

| Tier | Purpose | Code | Content | Edge | Host | Code writers | Content writers | Tier value | Debug surface | Analytics | Robots |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dev | Build and review one change. Preview draft content. | Any branch, or local files through `aem up`. | Preview partition. | None, or local Worker dev. | `localhost`; `https://{branch}--atreyu--<owner>.aem.page/<path>` | Contributors with repo write access. | Contributors with DA path access. | `dev` on localhost, `stage` on EDS branch hosts. | On. Authoring tools only on authoring hosts. | Off unless a real non-prod key exists. | EDS noindex on platform hosts. |
| stage | Rehearse Worker releases, routing cells, consent, analytics, and published content. | `main`. | Live partition. Published content only. | Staging Worker. | A dedicated staging host (planned). | Protected PR merge to `main`. | Publishers. | `stage`. | On for QA, except authoring tools stay authoring-host only. | Non-prod source when available. | Noindex and `Disallow: /` planned in the Worker. |
| prod | Serve visitors. | `main`. | Live partition. Published content only. | Production Worker. | `https://frame.io/` | Protected PR merge to `main`. | Publishers. | `prod`. | Off. | Production destination after consent. | Indexable, except system paths. |

Merge to `main` updates `main--atreyu--<owner>.aem.live` within minutes. The code gate is the PR. Staging is not an unreleased-code tier.

## Switches and URL parameters

| Switch | Kind | Where it applies | Gate |
|---|---|---|---|
| `EDS_DISABLED` | Operational kill switch | Worker | Sends routed traffic to the existing site. Not a tier. |
| Planned per-locale cell switch | Operational kill switch | Worker | Planned switch passed to `createIsEdsPath` to disable selected locale cells. Not a tier. |
| `?dapreview` | Authoring tool | Authoring hosts only | `isAuthoringPreviewAllowed`. |
| `?quick-edit` | Authoring tool | Authoring hosts only | `isAuthoringPreviewAllowed`. |
| `?experiment=` | QA and preview | Every host | Allowed everywhere. Forced variants are not tracked as exposures. |
| `?audience=` | QA and preview | Every host | Allowed everywhere. Forced variants are not tracked as exposures. |
| `?schedule=` | QA and preview | Non-production tier | `env.js` tier. |
| `?rum` | Diagnostics | Any host where the RUM script supports it | RUM runtime. |

New parameters must name their gate in the PR.

## Host classification

| Host | Today | After the Worker tier and client change |
|---|---|---|
| `localhost:3000` | `dev`. | `dev`. |
| `localhost:8787` | `dev`. | `dev`. |
| `{branch}--atreyu--<owner>.aem.page` | `stage`. | `stage`; EDS host pattern wins over metadata. |
| `main--atreyu--<owner>.aem.live` | `stage`. | `stage`; EDS host pattern wins over metadata. |
| Worker staging on `workers.dev` | `prod`, because the host has no EDS branch marker. | Worker meta says `stage`, after the Worker strips authored tier meta and injects its own and the client starts reading it in the same change. Until then, it is `prod`. Missing metadata fails closed to `prod`. |
| Dedicated staging host | `prod`, because the host has no EDS branch marker. | Worker meta says `stage`, after the Worker strips authored tier meta and injects its own and the client starts reading it in the same change. Until then, it is `prod`. Missing metadata fails closed to `prod`. |
| `frame.io` | `prod`. | Worker meta says `prod`, after the Worker strips authored tier meta and injects its own and the client starts reading it in the same change. Missing metadata is still `prod`. |

## What staging can and cannot prove

Staging can prove Worker behaviour, routing, consent, analytics destinations, cache behaviour, and published content. It cannot show unpublished DA content through the Worker. It cannot test unmerged site code unless a future per-ref staging host is added.
