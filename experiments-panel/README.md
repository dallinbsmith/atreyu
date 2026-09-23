# Experiments panel

Read-only authoring view of `adobe/aem-experimentation` tests, opened from the AEM Sidekick as a
floating palette. It shows what the plugin will actually do, using the same parsing rules as the
plugin; `test/utils/experiments/config.test.js` checks this against the vendored plugin.

- **This page:**
  - every test on the current page: whole-page (head metadata) and section-level (section metadata);
  - where each test is configured (page doc or metadata sheet);
  - status, audiences, dates, and variants with their effective split;
  - preview links (`?experiment=<id>/<variant>`);
  - which variant this tab is serving.
- **Sitewide:** every whole-page test defined in the bulk metadata sheets (`/metadata.json`,
  `/metadata-experiments.json`). Section tests live in page docs, so they only appear in the page
  view.
- **Checks:** the silent failure modes of the plugin:
  - splits over 100%;
  - fewer split values than variants (the plugin gives the rest 0%);
  - unknown audience or status;
  - bad or inverted dates;
  - a variant pointing at the control page;
  - missing variant pages;
  - duplicate test ids across sheet rows;
  - page metadata silently overriding a sheet row.

  A test with an error-level problem is shown as "Blocked".

Open it directly for local work: `/experiments-panel/index.html?page=/some/path` (add `&view=site`
for the sitewide view).

## Registering it

### Option A (recommended): DA editor sidebar, via DA Config

Self-service in the UI, which is how the Library was registered (the admin API returns 403 on
this org; see F-51/F-56 in `artifacts/research/eds-poc-findings.md`). Open
`https://da.live/config#/dallinbsmith/atreyu/`, go to the `library` sheet, and add a row:

| title | path | experience |
|---|---|---|
| Experiments | https://main--atreyu--dallinbsmith.aem.page/experiments-panel/index.html | inline |

Until #86, #87 and #88 are merged, `main` does not have the panel (404). For testing before then,
use the branch preview `https://feat-experiments-panel--atreyu--dallinbsmith.aem.page/...` instead.
Its content is the same, and it runs the branch code.

Use the absolute preview URL: DA resolves relative paths to `aem.live`, which would show published
rather than preview content. Save the config, open any page doc in DA, and pick "Experiments" in
the library panel. DA posts the doc path to the panel (verified in adobe/da-live
`blocks/edit/da-library/da-library.js`), and the panel accepts that message only from
`https://da.live`.

### Option B: Sidekick button on preview/live pages

Sidekick reads plugins from the persisted site config, not from this repo. Merge this entry into
`sidekick.plugins` via the admin config service
(https://www.aem.live/docs/config-service-setup#update-sidekick-configuration). This needs admin
API rights, which this org does not currently have.

```json
{
  "id": "experiments",
  "title": "Experiments",
  "url": "/experiments-panel/index.html",
  "isPalette": true,
  "passReferrer": true,
  "paletteRect": "top:80px;right:20px;width:560px;height:70vh",
  "environments": ["dev", "preview", "live"]
}
```

## Where to author tests

Use the standard bulk metadata sheet, `/metadata.json` (a DA sheet named `metadata` at the site
root). EDS applies it with no config change. Add `URL`, `Experiment`, `Experiment Variants` and,
optionally, `Experiment Split` / `Experiment Audience` / `Experiment Start Date` /
`Experiment End Date` / `Experiment Status` columns. Preview and publish the sheet after each change.

- Create the sheet once in DA's UI and never move, copy or rename it. DA's move/copy drops the
  sheet binding (F-57); in-place edits are safe.
- A dedicated `/metadata-experiments.json` is supported by EDS, but only once it is listed in the
  site config's metadata sources (admin `POST /config/{org}/sites/{site}/metadata.json` with
  `{"source": ["/metadata.json", "/metadata-experiments.json"]}`), which needs admin API rights.
  The panel already reads both sheets.
- Page metadata always beats bulk metadata, which is why the panel flags that override.

## Notes

- Sidekick appends `referrer=<current page URL>` (`passReferrer`, verified in adobe/aem-sidekick
  `src/extension/app/store/app.js`) and resolves the palette URL against the preview host. On
  preview pages the panel is same-origin and shows everything. On live, prod or localhost it reads
  the preview copy of the page and sheets, and "Serving in this tab" is hidden (cross-origin
  parent).
- Read-only. Editing (the Sanity-style create-variant flow) is a later step; see ADR-005.
- The panel is served publicly like any code-bus file, but it only reads data that is already
  public (page HTML, published metadata sheets). It is `noindex`.
