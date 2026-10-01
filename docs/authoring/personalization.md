# Authoring tests and personalization

How authors set up A/B tests and audience personalization in DA. How it works underneath: [architecture/personalization.md](../architecture/personalization.md).

**Today these only reach visitors in preview.** In production the engine waits for personalization consent, which nothing grants yet, and frame.io is not yet served through the Worker. Build and preview tests now; they go live when those land ([status.md](../status.md#personalization-and-experimentation)).

## Choose the tool

| Goal | Use |
|---|---|
| A/B test a whole page on one page | **Experiment** table in that page |
| A/B test many pages at once | Experiment columns in the bulk `/metadata` sheet |
| Show a different version of one section to an audience | **Personalize** table in that section |

Rules that apply to all of them:

- English pages only. Locale pages and `/xx-xx/v/` variants are ignored.
- Don't personalize the header, footer or navigation.
- Don't run an A/B test and a personalization on the same content; personalization takes precedence.
- Never put `Experiment`, `Audience`, `Variant` or `Campaign` rows in Section Metadata ([section-metadata.md](section-metadata.md#keys-you-must-not-use)).

## Variant pages: `/v/`

Every variant is an ordinary DA page under `/v/` (for example `/v/c2c-headline`). Preview and publish it. The visitor's URL never changes: the plugin fetches the variant and swaps its content into the original page.

- On frame.io (through the Worker), `/v/` pages are served only to that fetch; a direct visit gets 404. They are excluded from the index and sitemap.
- On `aem.page`/`aem.live` they stay directly reachable for authors (those hosts send `noindex`).
- A variant outside `/v/` is rejected (Personalize) or flagged (panel).

**Retiring a variant:** delete it in DA, add a row to the `/redirects` sheet pointing it at the original page, then preview and publish the sheet. (With this org's permissions, deleting a page doesn't unpublish it.)

## Experiment table (whole page)

Insert "Experiment" from the DA Library, or type a table whose header is `Experiment`, anywhere in the page:

| Experiment | |
|---|---|
| Test Name | `c2c-headline` (required; becomes the test id in analytics and preview links) |
| Variants | link(s) to the variant page(s) under `/v/`, one per line |
| Variant Names | readable names, comma-separated, same order |
| Split | % of all visitors per variant, comma-separated; control gets the rest; blank = even split |
| Audience | `mobile` or `desktop`; blank = everyone |
| Start Date / End Date | `YYYY-MM-DD`; blank = open |
| Status | `active` or `inactive` |

- Only the first Experiment table on a page is used. It replaces any other whole-page experiment metadata for that page (page metadata and sheet rows).
- The table never renders; it is converted and removed before the page draws.

## Bulk tests: the `/metadata` sheet

In the site-root `metadata` sheet, add the columns `URL`, `Experiment`, `Experiment Variants` and optionally `Experiment Split`, `Experiment Audience`, `Experiment Start Date`, `Experiment End Date`, `Experiment Status`. Preview and publish the sheet after each change. Page metadata (and an Experiment table) beats the sheet. Never move, copy or rename the sheet.

## Personalize table (one section)

Place the table inside the section it changes. Build it with the experiments panel's **Personalize** tab, or type it:

| Personalize | |
|---|---|
| Name | `pricing-mobile-hero` |
| Audience: mobile | `/v/pricing-mobile-hero` |
| Audience: campaign-spring-launch | `/v/pricing-spring-hero` |
| Status | `active` |
| End Date | `2026-12-31` |
| Owner | team or person responsible |

| Row | Rule |
|---|---|
| `Audience: <id>` | 1 to 3 rows. Each links to a page under `/v/`. Unknown audiences and duplicates are dropped |
| `Status` | `active` (default) or `inactive`. Inactive only shows in non-production `?audience=` previews |
| `End Date` | Required. `YYYY-MM-DD`, at most 180 days ahead, runs through the end of that day. Missing, invalid or past drops the whole table |
| `Name`, `Owner` | Labels shown in the panel |

- When a visitor matches more than one audience, the first in this order wins: `mobile`, `desktop`, then campaign audiences. Row order in the table doesn't matter.
- Only the first Personalize table in a section counts.
- The variant page's content replaces the section's content.

### Audiences

| id | Visitor |
|---|---|
| `mobile` | Screen narrower than 768px |
| `desktop` | Screen 768px or wider |
| `campaign-<name>` | Arrived with `?utm_campaign=<name>` (or `?campaign=<name>`) |

## Preview

| URL parameter | Shows |
|---|---|
| `?experiment=<test-id>/<variant>` | A specific variant of a test |
| `?audience=<id>` | The page as that audience would see it (includes `inactive` Personalize rules outside production) |

Previews work on any host and don't record analytics. On preview hosts a plugin overlay lists the tests on the page.

## Experiments panel

The panel (`experiments-panel/`) lists every test on the page and across the site, flags silent failures (splits over 100%, missing variants, bad dates, reserved keys, variants outside `/v/`), and builds Experiment and Personalize tables. Open it from the DA Library ("Experiments") or directly at `/experiments-panel/index.html?page=/some/path` on the preview host. Setup and features: `experiments-panel/README.md`.
