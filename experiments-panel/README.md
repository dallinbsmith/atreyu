# Experiments panel

Authoring view of `adobe/aem-experimentation` tests, opened from the DA editor's library or the
AEM Sidekick. The page and sitewide views are read-only; Build test writes only when you click
Insert. It shows what the plugin will actually do, using the same parsing rules as the plugin;
`test/utils/experiments/config.test.js` checks this against the vendored plugin.

- **This page:**
  - every test on the current page: whole-page (head metadata) and section-level (section metadata);
  - where each test is configured (page doc or metadata sheet);
  - status, audiences, dates, and variants with their effective split;
  - preview links (`?experiment=<id>/<variant>`);
  - which variant this tab is serving.
- **Sitewide:** every whole-page test defined in the bulk metadata sheets (`/metadata.json`,
  `/metadata-experiments.json`). Section tests live in page docs, so they only appear in the page
  view.
- **Build test:** a form that writes the Experiment table into the DA doc (see
  [the Build test tab](#the-build-test-tab-dropdowns-and-date-pickers)).
- **Checks:** the silent failure modes of the plugin:
  - splits over 100%;
  - fewer split values than variants (the plugin gives the rest 0%);
  - unknown audience or status;
  - bad or inverted dates;
  - a variant pointing at the control page;
  - missing variant pages, or variant pages outside `/v/`;
  - duplicate test ids across sheet rows;
  - page metadata silently overriding a sheet row.

  A test with an error-level problem is shown as "Blocked".

Open it directly for local work: `/experiments-panel/index.html?page=/some/path` (add `&view=site`
for the sitewide view, or `&view=build` for the form).

## Registering it

### Option A (recommended): DA editor sidebar, via DA Config

Self-service in the UI, which is how the Library was registered (the admin API returns 403 on
this org; see F-51/F-56 in `artifacts/research/eds-poc-findings.md`). Open
`https://da.live/config#/dallinbsmith/atreyu/`, go to the `library` sheet, and add a row:

| title | path | format | ref |
|---|---|---|---|
| Experiments | https://main--atreyu--dallinbsmith.aem.page/experiments-panel/index.html | | |

Leave `format` and `ref` blank. A blank `ref` means `main`, which shows the entry to everyone.
There's no `experience` column, and none is needed: rows without one open in the sidebar
(`row.experience || 'inline'` in da-live `helpers.js`).

Two rules for DA Config that the new canvas editor enforces (checked against da-live
`blocks/canvas/ew-panel-extensions/helpers.js`):

- **Keep at least two tabs.** Canvas reads `conf.library.data`, which exists only in a multi-tab
  config. A single-tab config shows no library in canvas; the classic editor still shows it.
  The config has a `flags` tab containing a `_note` row for this reason. Don't delete that tab.
  Only keys that start with `ew.` change editor behavior.
- **Point library rows at `https://content.da.live/dallinbsmith/atreyu/...`** (e.g. the Blocks row
  and every row of the blocks sheet). Canvas fetches these URLs directly, and `aem.page`/`aem.live`
  send no CORS headers, so those fetches fail in canvas. `content.da.live` reads DA source, so
  library docs do not need to be previewed. The Experiments row is different: it loads in an iframe,
  so it stays on `aem.page`.

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

## Variant pages: the `/v/` folder

Visitors never see a variant's URL. The plugin fetches the variant page and swaps its content into
the control page, so the address bar stays on e.g. `/features/c2c`. Put every variant page under
`/v/` (e.g. `/v/c2c-headline`), preview it and publish it. The folder keeps variants out of sight:

- **Production Worker** (`workers/website/handlers/variants.js`): serves `/v/` pages only to the
  plugin's own same-origin `fetch()` (Fetch Metadata `Sec-Fetch-Dest: empty`), with
  `X-Robots-Tag: noindex` and `Cache-Control: no-store`. Direct visits, shared links and crawlers
  get a 404. Media under `/v/` is served normally. Browsers without Fetch Metadata (very old ones)
  get the 404 too, so the plugin shows them control.
- **Index and sitemap:** `helix-query.yaml` excludes `/v/**`, and `helix-sitemap.yaml` builds the
  sitemap from that index. The default no-config sitemap lists every published page, variants
  included.
- **Panel:** warns about any variant page outside `/v/`.

Only the production domain goes through the Worker. `aem.page`/`aem.live` URLs stay directly
reachable for authors, and AEM already sends `noindex` on those hosts.

## Where to author tests

### On one page: the Experiment table (recommended for business users)

Insert "Experiment" from the DA library, or type a table whose header cell is `Experiment`,
anywhere in the page doc:

| Experiment | |
|---|---|
| Test Name | c2c-headline (required; becomes the test id in analytics and preview links) |
| Variants | link(s) to the variant page(s) under `/v/`, one per line |
| Variant Names | readable names, comma-separated, in the same order |
| Split | % of all visitors per variant, comma-separated (control gets the rest; blank = even split) |
| Audience | `mobile` or `desktop` (blank = everyone) |
| Start Date / End Date | e.g. 2026-10-01 (blank = open) |
| Status | `active` or `inactive` |

Blank rows are ignored. `scripts/utils/experiments/block.js` turns the table into the same head
metadata the plugin reads and removes it before anything renders, so it never shows on the page.
The table replaces all other whole-page experiment metadata on that page (page metadata and sheet
rows); the panel warns when that happens. Only the first table on a page is used.

Library setup (one-time, in DA):

1. Create the doc `/system/library/blocks/experiment` containing the table above with example
   values. (Done: Status is `inactive` so an accidental insert does nothing.)
2. Add a row to the `/system/library/blocks` sheet in place: `name` = `experiment`,
   `path` = `https://content.da.live/dallinbsmith/atreyu/system/library/blocks/experiment`.
   Edit the sheet in place; never move or copy it (F-57). (Done.)
3. Value suggestions (type `/` in a value cell; both editors): an `options` tab on the same sheet
   with columns `blocks`, `key`, `values`. Values are separated by `|`, and `Label=value` shows a
   label but inserts the value. (Done: Status, Audience, Split and Variant Names.) The tab makes
   the sheet multi-sheet; DA still reads the block list from its first tab, `blocks`.

#### The "Build test" tab: dropdowns and date pickers

DA tables only hold text, so the panel's **Build test** tab provides the form: dropdowns for
Audience and Status, a suggestion list for Split, date pickers for Start and End Date, and the
same checks as the page view (inserting is disabled while there's an error). It pre-fills from the
page's previewed Experiment table.

- **Insert table in doc** sends the whole table to DA at the cursor (`sendHTML`), with every row
  present, so authors see every control.
- **Edit an existing table:** select the whole table in the doc, click **Load selected table**,
  change fields, then click Insert. The selection is still the table, so the table is replaced
  in place (verified in the canvas editor).
- Opened outside DA (Sidekick, `?page=`), the button becomes **Copy table**; paste it into the doc.
- `table.js` holds the pure helpers (read, check, write). Values are only ever set as text, and
  only same-site paths and `https://` URLs become links.

### Across many pages: the metadata sheet

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
