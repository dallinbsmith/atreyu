# DA content structure

Content is authored in Document Authoring (DA) at `https://da.live/#/dallinbsmith/atreyu` and read by EDS from `content.da.live/dallinbsmith/atreyu/` (`fstab.yaml`). This org and site are a sandbox; the Frame.io production DA org will replace them with the same structure.

Every top-level item maps 1:1 to a URL on the site, except `system/`.

## Path convention

A page at `/foo` is the document `foo` sitting **next to** a folder `foo/` that holds its children (`/foo/bar` is `foo/bar`). There is no `foo/index` convention. A page's DA path *is* its URL; the two can't be decoupled.

## Naming rules

1. **Pages:** no prefix. A hub page and its child folder share the same name (`/customers` + `/customers/*`, never `/customers` + `/case-studies/*`). DA won't catch a mismatch. Don't create a child folder before child content exists.
2. **Locale folders:** the exact code (`ja-jp`, `de-de`, …), mirroring the root tree. The Worker's locale routing requires it.
3. **Everything that isn't a page** (nav fragments, the Library, placeholders): under `system/`. Use plain words; a leading `_` can't be typed into DA's sheet-naming UI and a leading `-` is rejected by the preview pipeline.

DA's file browser shows a page, an empty folder and a sheet the same way. Check the item type before assuming.

**Never move, copy or rename a DA sheet.** DA's move drops the sheet binding. Edit sheets in place; to change a sheet's path, delete and recreate it.

## Structure

As recorded on 2026-10-01 (verify in DA before relying on a specific page):

```
/                         homepage
/contact
/blog, /glossary          placeholder landing pages (routing cohort phase1)
/integrations             placeholder landing page (phase1)
/integrations/davinci-resolve   real page
/customers, /resources    placeholder landing pages (planned cohort phase2)
/customers/sundance-film-festival   real page
/features/c2c             real page (the /features hub isn't authored yet)
/ja-jp/c2c                Japanese translation of /features/c2c (preview only)
/v/*                      A/B and personalization variant pages (see authoring/personalization.md)

/system/fragments/nav/header        header fragment (required for the nav to render)
/system/fragments/nav/header/*      header submenus and the language menu
/system/fragments/nav/footer        footer fragment
/system/library/blocks              DA Library sheet: one row per block example
/system/library/blocks/*            block example docs
/system/library/templates (+ /*)    template sheet and docs
/system/library/icons               icon reference
/system/placeholders                legacy Key/Text sheet, used only by the DA Library
/system/placeholders/<namespace>    UI string sheets read by code (see Placeholders)

/ja-jp/system/fragments/nav/...     Japanese header and footer
/ja-jp/system/placeholders/...      Japanese UI strings
```

`/features/*` is not in any routing cohort yet, so on frame.io those URLs still come from the existing site.

### Target page tree

Mirrors the current frame.io information architecture so URLs don't change:

```
/features                 hub; children: workflow-management, file-management, present,
                          review-and-approval, c2c, mounted-storage, ios-ipad
/drive                    root level (frame.io doesn't nest it under /features)
/enterprise               hub; audience pages (media-and-entertainment, agencies, brands)
                          and use-case pages (video-workflows, photo-workflows, campaign-workflows)
/pricing                  single page
/integrations, /customers, /glossary, /resources, /contact, /whats-new   root level
```

`blog.frame.io`, `help.frame.io`, `app.frame.io` and other subdomains are separate platforms; nav fragments link to them as external URLs.

## Placeholders

UI strings that code shows (button labels, ARIA text, form messages) live in DA sheets so they can be translated. Code: `scripts/utils/placeholders.js`. Code rules: [conventions/blocks.md](../conventions/blocks.md#content-and-copy).

- **Layout:** one sheet per namespace at `/system/placeholders/<namespace>`, columns `Key` and `Text`. Namespace names match `^[a-z][a-z-]*$`.
- **Lookup:** `getPlaceholder('forms.submit', 'Submit')` reads row `submit` (case-insensitive) of sheet `forms`. A key without a valid namespace returns the fallback without fetching.
- **Missing text:** a missing locale sheet, missing row or blank `Text` shows the code fallback (English). There is no fallback to the English sheet, so keep English sheet rows equal to the code fallbacks.
- **Keys:** `namespace.camelCaseRole` (`controls.prevSlide`), never named after the English wording. Never rename a translated key; add a new one.
- **Tokens:** `{current}`, `{total}`, `{name}` and similar are filled by code and must survive translation unchanged.
- **Size:** keep a namespace under about 20 rows; split by concern before it grows.
- **Locales:** same path under the prefix (`/ja-jp/system/placeholders/forms`). Only translated rows need to exist.
- **Translation risk:** the translation service can translate the `Key` column of a placeholder sheet, which silently breaks every lookup in that locale. Keep placeholder sheets out of automated translation jobs until that is confirmed fixed; fill them manually or with `tools/locale-extractor`.

Keys used by code (derived from `getPlaceholder` calls; if this table and the code disagree, the code wins):

| Namespace | Key | English | Used by |
|---|---|---|---|
| `nav` | `main` | Main | header-nav |
| | `language` | Select language | header-actions |
| | `scheme` | Toggle color scheme | header-actions |
| | `menuToggle` | Toggle navigation menu | header-actions |
| | `breadcrumbHome` | Home | `seo/jsonld.js` |
| `controls` | `carousel` | Carousel | carousel, carousel-media, carousel-with-touts |
| | `prevSlide` | Previous slide | same three |
| | `nextSlide` | Next slide | same three |
| | `slidePosition` | {current} of {total} | same three |
| | `goToCard` | Go to card {current} of {total} | card-grid-landscape |
| | `pause` | Pause | `media/video.js`, footer-glow, logo-wall, logo-tile-wall |
| | `play` | Play | same four |
| | `showMore` | Show more | card-grid-editorial |
| | `showLess` | Show less | card-grid-editorial |
| `media` | `videoTitle` | YouTube Video | youtube |
| | `playTitle` | Play {title} | youtube |
| | `watchVideo` | Watch the Video | video-playlist |
| `forms` | `submit` | Submit | form |
| | `sending` | Sending… | form |
| | `success` | Thank you! Your submission has been received. | form |
| | `honeypotSuccess` | Thank you! | form |
| | `error` | Something went wrong. Please try again. | form |
| | `selectPlaceholder` | Select {label} | form |
| | `required` | This field is required | form |
| | `requiredCheckbox` | This field must be checked | form |
| | `invalidEmail` | Enter a valid email | form |
| | `invalidValue` | Enter a valid value | form |
| | `patternMismatch` | Please match the requested format | form |
| | `tooShort` | Enter at least {min} characters | form |
| | `schedulerUnavailable` | This scheduling widget is not available right now. | hero-calendly |
| `tile-table` | `prev`, `next`, `close` | Previous, Next, Close | tile-table modal |
| | `closed` | Partner details closed | tile-table modal |
| | `visit` | Visit {name} | tile-table modal |
| | `counter` | {current} of {total} | tile-table modal |
| | `opened` | {name}, partner {current} of {total} | tile-table modal |
| `pricing` | `mostPopular` | Most Popular | pricing |

`tile-table` is a deliberate exception to naming by concern, not a precedent for one namespace per block.

## Locale content

Each locale mirrors the root `system/` layout under its prefix: header and footer fragments (with submenus) and placeholder sheets. A planned localized 404 will live at `/<locale>/system/fragments/404`. Missing locale fragments fall back to the English ones; missing placeholder rows fall back to the code default. Details: [architecture/locale.md](../architecture/locale.md).

- In locale chrome, page links are written with the prefix (`/ja-jp/<slug>`); fragment references stay unprefixed (`/system/fragments/nav/header/features`) because the code adds the locale.
- Each locale page is an independent document. Don't convert locale pages to shared templates with overrides; independent pages are what allow a locale to differ in content later.
- Translation staging is `/langstore/en` → `/langstore/<locale>`, never published. The DA translation config is `/.da/translate.json`.

## Personalization and A/B content

See [personalization.md](personalization.md). In short: whole-page tests use an **Experiment** table, section personalization uses a **Personalize** table, variant pages live under `/v/`, and Section Metadata never carries experiment or audience keys.

## Redirects

Redirects for EDS-served paths are rows in the `redirects` sheet at the site root (`/redirects.json`): `Source`, `Destination`. Preview and publish the sheet after each change. Use relative destinations. Behaviour: [architecture/worker.md](../architecture/worker.md#redirects).

## Not built yet

- Page templates under `/templates/*` (blog post, glossary term, integration, customer story, resource): waiting for the blocks they'd use.
- Shared data sheets (testimonials, CTAs) and author bio pages.
- Locale folders other than `ja-jp`.
