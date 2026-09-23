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

## Registering the Sidekick button

Sidekick reads plugins from the persisted site config, not from this repo. Merge this entry into
`sidekick.plugins` via the admin config service
(https://www.aem.live/docs/config-service-setup#update-sidekick-configuration):

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

## Dedicated experiments sheet

EDS only applies `/metadata-experiments.json` as bulk metadata once it is listed in the site
config's metadata sources (admin `POST /config/{org}/sites/{site}/metadata.json` with
`{"source": ["/metadata.json", "/metadata-experiments.json"]}`). Page metadata always beats bulk
metadata, which is why the panel flags that override.

## Notes

- Sidekick appends `referrer=<current page URL>` (`passReferrer`, verified in adobe/aem-sidekick
  `src/extension/app/store/app.js`) and resolves the palette URL against the preview host. On
  preview pages the panel is same-origin and shows everything. On live, prod or localhost it reads
  the preview copy of the page and sheets, and "Serving in this tab" is hidden (cross-origin
  parent).
- Read-only. Editing (the Sanity-style create-variant flow) is a later step; see ADR-005.
- The panel is served publicly like any code-bus file, but it only reads data that is already
  public (page HTML, published metadata sheets). It is `noindex`.
