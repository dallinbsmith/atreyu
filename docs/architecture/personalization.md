# Personalization and experimentation (as built)

There is **one engine**: Adobe's [aem-experimentation](https://github.com/adobe/aem-experimentation) plugin, vendored at `plugins/experimentation/`, driven by `scripts/experiment-loader.js`. It runs whole-page A/B tests and audience personalization (show a different section to a matching audience). An earlier project-specific engine was removed; it is recoverable from the git tag `pzn-legacy-final` but is not to be revived ([ADR-0006](../decisions/0006-one-personalization-engine.md)).

**Production reach today is zero.** The code gates every non-preview run on personalization consent, and nothing in production grants it yet; and frame.io is not yet behind the Worker. Previews (`?experiment=`, `?audience=`) work on every host. See [status.md](../status.md#personalization-and-experimentation).

Author-facing instructions: [authoring/personalization.md](../authoring/personalization.md).

## Pieces

| Piece | Path | Role |
|---|---|---|
| Plugin | `plugins/experimentation/` | Upstream code, vendored with `git subtree`. Never hand-edit; it is lint-ignored. Update with `git subtree pull` |
| Loader | `scripts/experiment-loader.js` | `runExperimentation()` (eager) and `runExperimentationLazy()` (non-prod overlay) |
| Experiment table compiler | `scripts/utils/experiments/block.js` | Turns an authored **Experiment** table into the head `<meta>` tags the plugin reads |
| Personalize table compiler | `scripts/utils/experiments/personalize.js` | Turns an authored **Personalize** table into `Audience: <id>` Section Metadata rows |
| Audiences | `scripts/utils/experiments/audiences.js` | The audience catalog (`CATALOG`) |
| Guards | `scripts/utils/experiments/guard.js` | 1 s variant-fetch timeout, Section Metadata hygiene, config-block removal |
| Shared parsing | `scripts/utils/experiments/config.js` | Parsing and validation shared with the panel. Must not import `ak.js` (`npm run test:config-sync` checks) |
| Experiments panel | `experiments-panel/` | DA/Sidekick panel: lists tests, checks for silent failures, builds Experiment and Personalize tables. See `experiments-panel/README.md` |
| Worker variant gate | `workers/website/handlers/variants.js` | Serves `/v/` pages only to the plugin's same-origin fetch |

## Runtime sequence

`scripts.js` `loadPage()` awaits `runExperimentation()` after `setConfig()` and before `loadArea()`, so variants are swapped in before any decoration or LCP. In order:

1. `applyExperimentBlock`: the page's first Experiment table becomes `experiment*` head metadata (replacing any existing experiment metadata), and every Experiment table is removed.
2. `stripPluginSectionMeta`: removes hand-written `experiment*`/`audience*`/`campaign*` rows from Section Metadata. Section-level configuration comes only from Personalize tables.
3. `applyPersonalizeTables`: compiles each section's first Personalize table into `Audience: <id>` → `/v/…` rows (rules below) and removes all Personalize tables.
4. `removeLeftoverConfigBlocks`.
5. Stop unless the page has experiment/campaign/audience head metadata or plugin Section Metadata keys (`isEnabled`).
6. **Consent gate:** stop (and clear stored assignments) unless `hasConsent('personalization')` or the URL has `?experiment=` or `?audience=`.
7. Import the plugin and run `loadEager` with the audience catalog, inside `withVariantTimeout` (a variant fetch slower than 1000 ms is aborted and the original content stays).
8. Persist assignments to `localStorage` (`unified-decisioning-experiments`) only with consent.
9. Track one `EVENTS.EXPERIMENT` event per running test (skipped for previews).

Any error is logged and the page renders the control.

`runExperimentationLazy()` (from `lazy.js`) loads the plugin's preview overlay on non-production hosts only.

## Audiences

| id | Matches |
|---|---|
| `mobile` | Viewport narrower than 768px |
| `desktop` | Viewport 768px or wider |
| `campaign-<name>` | `utm_campaign` or `campaign` query parameter equals `<name>` (normalized with `toClassName`) |

Catalog order is precedence: when a visitor matches several audiences in one section, the first in catalog order wins, regardless of table row order. Audiences that need server facts (country, logged-in, company) are planned, not built ([ADR-0008](../decisions/0008-client-decides-edge-supplies-facts.md)).

## Personalize table rules

Enforced by `scripts/utils/experiments/personalize.js`:

| Row | Rule |
|---|---|
| `Name` | Label for the panel and warnings |
| `Audience: <id>` → link | 1 to 3 rows (`MAX_RULES`). Unknown audiences, duplicates and paths not under `/v/` are dropped. Locale-prefixed variant paths (`/de-de/v/…`) are dropped: personalization is English-only ([ADR-0011](../decisions/0011-english-only-personalization.md)) |
| `Status` | `active` (default when blank) or `inactive`. Inactive rules only apply to non-production `?audience=` previews |
| `End Date` | Required, `YYYY-MM-DD`, at most 180 days ahead (`MAX_DAYS`). Runs through the end of that day in the visitor's time zone. Missing, invalid or past → all rules dropped |
| `Owner` | Label for the panel |

Only the first Personalize table in a section is used; later ones are ignored with a warning. Warnings appear in the console on non-production hosts only.

## Variant pages (`/v/`)

Variants are ordinary DA pages under `/v/`. The plugin fetches one and swaps its content in, so the visitor's URL doesn't change. The Worker serves `/v/` only to that same-origin fetch, with `noindex` and `no-store`, and returns 404 to anyone else. `/v/**` is excluded from the query index and sitemap.

## Policies

- No personalization of header, footer or navigation ([ADR-0013](../decisions/0013-no-chrome-personalization.md)).
- Personalization beats A/B: don't run an A/B test and a personalization on the same content ([ADR-0007](../decisions/0007-personalization-precedence.md)). This is an authoring rule today; the panel shows both on a page.
- English only ([ADR-0011](../decisions/0011-english-only-personalization.md)).
- Tests and personalization are not meant to be consent-gated in the long run ([ADR-0010](../decisions/0010-consent-model.md)); the code still gates them until the consent manager ships.
