# 0019. Environment model: one EDS site, three tiers

**Status:** Accepted. Partly implemented. Worker tier injection is planned, not yet implemented. `scripts/utils/env.js` EDS and localhost classification is being implemented in a parallel PR; reading Worker tier metadata must land with the Worker change that strips authored copies and injects its own.

## Decision

Use one EDS site and three tiers.

| Tier | Meaning |
|---|---|
| `dev` | Localhost and branch previews. A branch is served at `https://{branch}--atreyu--<owner>.aem.page/` with preview content. |
| `stage` | A staging Worker in front of `main` code and published content from the live partition. |
| `prod` | The production Worker on `frame.io`, using `main` code and published content. |

There is no `qa` tier, no long-lived `staging` branch, and no separate EDS site per environment. Adobe's staging guidance recommends PR gates for code, and a separate CDN staging host only when custom edge code needs rehearsal. It also advises against mapping a long-lived staging branch to a separate CDN site. Separate EDS sites are deferred because they add content sync and access configuration work.

Merge to `main` is live on `main--atreyu--<owner>.aem.live` within minutes. The pre-production gate for code is the PR: review, CI, and evidence on the branch preview. Staging rehearses Worker releases, routing cells, consent and analytics, and published content. Staging does not rehearse unreleased code. Staging cannot show unpublished content through the Worker.

The Worker will declare the tier with a required `DEPLOY_TIER` variable in every Wrangler environment. In one change, the Worker will strip any authored `<meta name="deploy-tier">`, inject exactly one Worker-owned tag, and the client will start reading it:

```html
<meta name="deploy-tier" content="dev|stage|prod">
```

`scripts/utils/env.js` keeps the existing `dev`, `stage`, `prod` API and classifies hosts in this order:

1. `localhost` is `dev`.
2. Adobe EDS hosts matching `*--*--*.aem.page` or `*--*--*.aem.live` are `stage`, and any meta tag is ignored.
3. Other hosts use a valid Worker meta value after the Worker stripping and injection change lands.
4. Missing or invalid tier metadata is `prod`. Until that change lands, any non-EDS, non-localhost host is `prod`.

This fails closed. An unknown host does not get non-production tools.

Non-tier questions stay separate:

- Segment loads only when there is a real write key for the current destination.
- Authoring preview tools use `isAuthoringPreviewAllowed`.
- `?experiment=` and `?audience=` stay available on every host, but forced variants are not recorded as exposures.
- Staging hosts must be `noindex`. This is a planned Worker change.

## Consequences

- A code PR must include a branch preview URL and enough evidence for reviewers to make the merge decision.
- There is no post-merge code promotion step before `main--atreyu--<owner>.aem.live` changes.
- Worker releases still need a staging rehearsal before production deployment.
- `EDS_DISABLED` is an operational kill switch, not a tier. A per-locale cell switch passed to `createIsEdsPath` is planned, but not implemented.
- New URL parameters or environment-dependent behaviour must state their gate: tier, authoring-host permission, consent, or another named guard.

## Alternatives considered

- **Separate EDS sites per environment.** Rejected for now. It adds content synchronization and duplicate access configuration without solving the normal branch preview workflow.
- **A long-lived staging branch.** Rejected. Branches share the same content partitions, and Adobe advises against this staging shape.
- **Per-ref staging hosts.** Deferred. Add this only if a release needs to test unmerged code behind the Worker, for example `{ref}.stage.example.com` pointing to `{ref}--atreyu--<owner>.aem.live`.
