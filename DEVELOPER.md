# Atreyu Developer Guide

Developer onboarding for the Atreyu project -- Frame.io on AEM Edge Delivery Services.

No build step. No bundler. No framework. Vanilla ES2025 served via HTTP/2 from CDN.

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (for Worker development)

### Clone and install

```bash
git clone https://github.com/aemsites/author-kit.git atreyu
cd atreyu/site
npm install
```

### Content source

Content is authored in [Document Authoring (DA)](https://da.live). The mount is configured in `fstab.yaml`:

```yaml
mountpoints:
  /:
    url: https://content.da.live/dallinbsmith/atreyu/
    type: markup
```

### Preview and publish

| Environment | URL pattern | Purpose |
|---|---|---|
| Preview (`.page`) | `https://main--author-kit--aemsites.aem.page/` | Instant preview of authored content |
| Live (`.live`) | `https://main--author-kit--aemsites.aem.live/` | CDN-cached production origin |
| Production | Custom domain via Cloudflare Worker | BYO CDN with CSP headers and routing |

To preview a page you are editing, open it in DA and use the Sidekick extension to preview/publish.

### Local Worker development

```bash
cd workers/website
npm install
npx wrangler dev
```

This starts a local server that proxies requests through the Cloudflare Worker to `aem.live`, letting you test route handlers, redirects, and CSP headers locally.

### Lint and test

```bash
npm run lint          # ESLint + Stylelint
npm run lint:js       # ESLint only
npm run lint:css      # Stylelint only
npm run test          # Web Test Runner
npm run test:watch    # Watch mode
```

All JS and CSS must pass lint before commit.

---

## Architecture Overview

### Eager-Lazy-Delayed (E-L-D) loading

Every page loads in three phases, aligned to Core Web Vitals:

```
Eager (LCP)              Lazy (after LCP)           Delayed (3s+)
──────────────────────   ──────────────────────────  ─────────────────────
ak.js                    Remaining sections + blocks  Analytics
scripts.js               Header / Footer              Consent manager
styles.css               lazy-styles.css              Chat widgets
First section only       fonts.css                    Tag managers
                         postlcp.js / lazy.js
```

**Eager** -- Critical path to Largest Contentful Paint. `ak.js` and `scripts.js` load from `head.html`, decorate the DOM, and render only the first section. Keep aggregate payload under 100 KB.

**Lazy** -- After LCP fires. `postlcp.js` loads the header, then `lazy.js` loads remaining sections, footer, fonts, `lazy-styles.css`, JSON-LD, hreflang tags, and favicons. Block JS and CSS auto-load per section.

**Delayed** -- 3 seconds after LCP. `delayed.js` loads third-party scripts (analytics, consent, martech). Nothing in this phase may block Interaction to Next Paint.

### What `ak.js` does

`ak.js` is the core framework. It handles:

- **Section decoration** -- wraps `<main> > <div>` elements into sections, groups children into `.default-content` and `.block-content` wrappers
- **Block loading** -- auto-discovers `<div class="blockname">` elements, imports `blocks/blockname/blockname.js` and `.css`
- **Link decoration** -- strips origin from internal links, localizes URLs, detects auto-blocks (fragments, YouTube, schedules), converts bold/italic links to buttons
- **Icon loading** -- replaces `<span class="icon icon-name">` with inline SVGs from `/icons/`
- **Picture decoration** -- adds a high-resolution `<source>` for viewports 1440px+

Key exports: `setConfig`, `getConfig`, `loadStyle`, `loadExperience`, `loadBlock`, `loadArea`, `getMetadata`, `getLocale`, `decorateLink`, `localizeUrl`.

### How blocks auto-load

1. Author creates a table in DA with a header row naming the block (e.g., "Hero (large, dark)")
2. EDS converts the table to `<div class="hero large dark">` containing rows and columns
3. `ak.js` finds the div, imports `blocks/hero/hero.js` and `blocks/hero/hero.css`
4. The block's default export receives the `<div>` and decorates it in-place

### How sections work

Sections are `<div>` children of `<main>`, separated by `---` in the authored document. Each section can include a Section Metadata table to control styling:

| Key | Effect |
|---|---|
| `style` | CSS classes on the `<section>` (e.g., `dark`) |
| `background` | Image URL, CSS color, or `color-token-*` design token |
| `grid` | Column count (2-6) applied to `.block-content` children |
| `gap` / `spacing` | Spacing tokens (`xs`, `s`, `m`, `l`, `xl`, `xxl`) |
| `container` | Content width constraint (2, 4, or 6) |
| `layout` | `bento` for asymmetric grid |

For the full architecture, see [CLAUDE.md](../CLAUDE.md).

---

## Creating a New Block

### Step 1: Create the folder

```
blocks/
  my-block/
    my-block.js
    my-block.css
```

The folder name and file names must match. Use lowercase, hyphenated names.

### Step 2: Write the JS

Every block exports a default function that receives the block's root `<div>`:

```javascript
// blocks/my-block/my-block.js
export default (el) => {
  const rows = [...el.children];
  const [firstRow] = rows;
  const [col1, col2] = [...firstRow.children];

  // Decorate the DOM in-place
  col1.classList.add('my-block-title');
  col2.classList.add('my-block-body');
};
```

For async work (e.g., fetching data):

```javascript
import { fetchData } from '../../scripts/utils/fetch-data.js';

export default async (el) => {
  const link = el.querySelector('a');
  const data = await fetchData(link?.href);
  if (!data) return;

  const list = document.createElement('ul');
  for (const item of data.data) {
    const li = document.createElement('li');
    li.textContent = item.Name;
    list.append(li);
  }
  el.replaceChildren(list);
};
```

### Step 3: Write the CSS

Scope styles under the block class name using native nesting:

```css
/* blocks/my-block/my-block.css */
.my-block {
  display: grid;
  gap: var(--spacing-m);
  padding: var(--spacing-l);

  .my-block-title {
    font-size: var(--heading-font-size-m);
    color: var(--color-heading);
  }

  .my-block-body {
    color: var(--color-text);
  }

  @media (width >= 768px) {
    grid-template-columns: 1fr 1fr;
  }
}
```

Reference design tokens from `:root` in `styles/styles.css`. Never hardcode colors, spacing, or font sizes.

### Step 4: Test locally

1. Author a page in DA with a table named "My Block"
2. Preview it on `.aem.page` -- `ak.js` auto-loads your block JS and CSS
3. Run `npm run lint` to verify your code passes

### Step 5: Add variants (optional)

Authors set variants in the block table header: `My Block (wide, dark)` produces `<div class="my-block wide dark">`. Style variants with:

```css
.my-block {
  &.wide { max-width: 100%; }
  &.dark { --my-block-text: var(--color-light); }
}
```

### Rules to remember

- Keep block JS under 100 lines -- extract helpers to `scripts/utils/` if larger
- Blocks must never be nested inside other blocks
- Never style `-container` or `-wrapper` elements generated by the framework
- Handle missing content gracefully -- authors may leave fields empty
- Check the [block catalog](tools/sidekick/blocks.md) before building a new block

---

## Available Utilities

All utilities live in `scripts/utils/`. Import with explicit `.js` extensions.

| Module | Exports | Description |
|---|---|---|
| `a11y.js` | `generateId(prefix)`, `rovingTabindex(container, items, options)`, `trapFocus(container)`, `announce(message, priority)` | Accessibility helpers: unique IDs, keyboard navigation for tab-like widgets, focus trapping for modals, live-region announcements for screen readers |
| `analytics.js` | `track(event, properties)`, `setAnalyticsProvider(fn)` | Queue-based analytics. Call `track()` from blocks; events queue until the provider is set in `delayed.js`. Each event is auto-enriched with timestamp, URL, and locale. |
| `env.js` | default export (`'prod'` / `'stage'` / `'dev'`) | Detects environment from hostname. `--` in host = stage, `local` = dev, everything else = prod. |
| `error.js` | default export `(ex, el)` | Logs errors to console. In non-prod, wraps the failing element in a visible `.has-error` container. |
| `event-bus.js` | `emit(name, detail)`, `on(name, handler)`, `off(name, handler)` | Namespaced (`atreyu:*`) event bus on `document` for inter-block communication. `on()` returns a cleanup function. |
| `favicon.js` | (self-executing) | Sets favicon and apple-touch-icon from `img/favicons/`. Reads `favicon` metadata for custom name. |
| `fetch-data.js` | `fetchData(url, options)` | Fetches JSON with automatic caching. Supports `sheet`, `limit`, and `offset` options for EDS spreadsheet endpoints. |
| `footer.js` | default export `()` | Loads the global footer block from `footer` metadata or the default footer class. |
| `fragment.js` | `loadFragment(path)`, `getReplaceEl(anchor)` | Fetches a fragment page, decorates its blocks, and returns the fragment DOM. `getReplaceEl` finds the correct ancestor to replace when inlining. |
| `hreflang.js` | default export `()` | Injects `<link rel="alternate" hreflang="...">` tags for all configured locales. |
| `icons.js` | default export `(icons)` | Replaces `<span class="icon icon-name">` elements with inline SVG `<use>` references to `/icons/name.svg`. |
| `jsonld.js` | `inject(data)`, `flush()`, default export `()` | Manages a JSON-LD `@graph` in `<head>`. `inject()` adds a schema entry; `flush()` writes to the DOM. Default export builds site-wide schema (Organization, WebSite, WebPage, BreadcrumbList). |
| `lazyhash.js` | (self-executing) | After lazy load, scrolls to the element matching the URL hash that was stored before eager phase. |
| `motion.js` | `shouldAnimate()`, `getTransitionDuration(ms)`, `onReveal(el, callback, options)` | Motion guard: returns `false` if user prefers reduced motion, is on a slow connection, or has limited CPU. `onReveal` triggers a callback when an element enters the viewport. |
| `observer.js` | default export `(el, callback)` | Lightweight IntersectionObserver wrapper. Fires callback once when element enters viewport, then unobserves. |
| `picture.js` | `createPicture({ src, alt, eager, breakpoints })` | Programmatically creates a responsive `<picture>` element with WebP sources and breakpoint-based sizing. |
| `placeholders.js` | `getPlaceholders()`, `getPlaceholder(key, fallback)` | Fetches the locale-specific `/placeholders.json` spreadsheet. Returns a `Map` of key-value pairs for i18n text replacement. |
| `script.js` | default export `(src)` | Loads an external `<script>` tag into `<head>`. Returns a promise. Deduplicates by `src`. Uses `Promise.withResolvers()`. |
| `styles.js` | default export `(href)` | Fetches a CSS file and returns a `CSSStyleSheet` (constructable stylesheet). Caches by path. Accepts `.js` paths and swaps extension to `.css`. |

### Example: using the event bus between blocks

```javascript
// In block A -- emit when user selects a plan
import { emit } from '../../scripts/utils/event-bus.js';

export default (el) => {
  el.addEventListener('click', (e) => {
    const plan = e.target.dataset.plan;
    if (plan) emit('plan-selected', { plan });
  });
};
```

```javascript
// In block B -- react to plan selection
import { on } from '../../scripts/utils/event-bus.js';

export default (el) => {
  on('plan-selected', ({ plan }) => {
    el.querySelector('.price').textContent = prices[plan];
  });
};
```

### Example: fetching spreadsheet data

```javascript
import { fetchData } from '../../scripts/utils/fetch-data.js';

export default async (el) => {
  const data = await fetchData('/pricing.json', { sheet: 'plans' });
  // data.data is an array of { Name, Price, ... } objects
};
```

### Example: i18n with placeholders

```javascript
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

export default async (el) => {
  const label = await getPlaceholder('cta-signup', 'Sign Up Free');
  el.querySelector('.cta').textContent = label;
};
```

---

## Coding Standards Quick Reference

### JavaScript

| Rule | Example |
|---|---|
| Arrow functions only | `const fn = () => {}`, `export default (el) => {}` |
| `const` by default | `let` only for reassignment |
| No `function` keyword | ESLint enforces `func-style: expression` |
| Single-level ternaries | `const x = cond ? a : b` -- no nesting |
| Early returns | Return early instead of nesting `if/else` |
| Array methods over loops | `.find()`, `.filter()`, `.map()`, `.some()`, `.every()` |
| `for...of` when needed | DOM mutation, async iteration, cases where array methods do not fit |
| ES2025 features | `Promise.withResolvers()`, `Object.groupBy()`, `structuredClone()`, `.at(-1)` |
| Optional chaining | `el?.querySelector()`, `data ?? fallback`, `cache ??= new Map()` |
| `Map`/`Set`/`WeakMap` | Use over plain objects for dynamic keys or DOM associations |
| 2-space indent | Template literal contents are exempt |
| ESM only | `import`/`export` with explicit `.js` extensions. No CommonJS. |

### CSS

| Rule | Example |
|---|---|
| Reference design tokens | `var(--color-accent)`, never hardcode |
| Native nesting, 2-3 levels max | `.hero { .child { } }` |
| Range media queries | `@media (width >= 768px)` |
| Breakpoints | 768px (md), 1240px (lg), 1440px (grid cap) |
| Cascade layers | `@layer blocks` for block CSS |
| Block scope | Scope all selectors under the block class |
| No `-container` styling | Never style framework-generated wrappers |
| Variants via `&.name` | `&.dark { --hero-text: var(--color-light); }` |
| Animations in `lazy-styles.css` | Not in `styles.css` |
| `prefers-reduced-motion` guard | Required on all transitions/animations |

### Accessibility

- `:focus-visible` on all interactive elements (global styles handle this)
- `aria-expanded` on toggles that show/hide content
- `aria-label` on icon-only buttons
- Gate motion through `shouldAnimate()` from `motion.js`
- Blocks with structured content inject JSON-LD via `jsonld.js`

---

## Testing

Tests use [Web Test Runner](https://modern-web.dev/docs/test-runner/overview/) with `@esm-bundle/chai` for assertions and `sinon` for mocks/stubs.

### Run tests

```bash
npm run test               # All tests with coverage
npm run test:watch         # Watch mode
npm run test:file -- path  # Single file
```

### Test file location

Place tests alongside the code they cover, mirroring the `scripts/` structure:

```
test/
  scripts/
    scripts.test.js
  utils/
    a11y.test.js
    event-bus.test.js
    fetch-data.test.js
```

### Writing a new test

```javascript
import { expect } from '@esm-bundle/chai';
import { myFunction } from '../../scripts/utils/my-util.js';

describe('myFunction', () => {
  it('returns expected result for valid input', () => {
    const result = myFunction('input');
    expect(result).to.equal('expected');
  });

  it('handles edge case gracefully', () => {
    const result = myFunction(null);
    expect(result).to.be.null;
  });
});
```

### Mocking `fetch`

```javascript
let originalFetch;

beforeEach(() => { originalFetch = window.fetch; });
afterEach(() => { window.fetch = originalFetch; });

const mockFetch = (response) => {
  window.fetch = (...args) => Promise.resolve(response);
};
```

### What to test

- Utility functions: pure logic, edge cases, error handling
- Block init functions: DOM transformation given a known input structure
- Event handlers: verify correct events are emitted/consumed

---

## Cloudflare Worker

The Worker lives in `workers/website/` and serves as the BYO CDN layer between visitors and `aem.live`.

### Local development

```bash
cd workers/website
npm install
npx wrangler dev
```

`wrangler.toml` configures the AEM origin:

```toml
vars = { AEM_ORG = "aemsites", AEM_SITE = "author-kit" }
```

### Route handling

`index.js` defines a `ROUTES` array. Each route has a `match` function and a `handler`. Routes are evaluated in order; the first handler that returns a truthy response wins.

| Route | Handler file | Purpose |
|---|---|---|
| All paths (first pass) | `handlers/redirects.js` | Checks `/redirects.json` for 301 redirects. Returns `null` if no match, so the next route runs. |
| `/schedules/*.json` | `handlers/aem.js` (`fetchSchedule`) | Filters schedule JSON to only currently active events |
| `/dasc/*.json` | `handlers/dasc.js` | Proxies Dark Alley shortcode requests |
| `/drafts/*` | inline | Returns 404 in production |
| All paths (fallback) | `handlers/aem.js` (`fetchFromAem`) | Proxies to `aem.live` with caching, CSP headers, and nonce injection |

### Adding a new route

1. Create a handler in `workers/website/handlers/`:

```javascript
// handlers/my-handler.js
export default async ({ url, env, request }) => {
  // Return a Response, or null to pass to the next route
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

2. Add the route to `ROUTES` in `index.js` (order matters -- place it before the fallback):

```javascript
import fetchMyHandler from './handlers/my-handler.js';

// Add before the final catch-all route
{
  match: (path) => path.startsWith('/api/my-endpoint'),
  handler: fetchMyHandler,
},
```

3. Test with `npx wrangler dev` before deploying.

### CSP and security headers

Content Security Policy is set in `handlers/aem.js` on all HTML responses. Each response gets a unique cryptographic nonce (from `utils/nonce.js`) injected into `<script>` tags via `HTMLRewriter`. To allow a new embed source (e.g., Vimeo), update the `frame-src` directive in `fetchFromAem`.

---

## Common Patterns

### Fragment loading

Fragments are reusable content chunks authored as separate pages under `/fragments/`. Load one programmatically:

```javascript
import { loadFragment } from '../../scripts/utils/fragment.js';

export default async (el) => {
  const path = '/fragments/shared/promo-banner';
  const fragment = await loadFragment(path);
  el.replaceChildren(...fragment.children);
};
```

Authors can also inline fragments by pasting a `/fragments/...` link in their document -- the framework auto-detects it and loads the fragment block.

### Spreadsheet-driven blocks

EDS converts authored spreadsheets to JSON endpoints. Fetch them with `fetchData`:

```javascript
import { fetchData } from '../../scripts/utils/fetch-data.js';

export default async (el) => {
  const link = el.querySelector('a');
  const data = await fetchData(link.href, { sheet: 'features' });

  for (const row of data?.data ?? []) {
    const item = document.createElement('div');
    item.textContent = row.Title;
    el.append(item);
  }
  el.querySelector('.block-content')?.remove();
};
```

Options: `{ sheet: 'name' }` selects a sheet, `{ sheet: ['a', 'b'] }` selects multiple, `{ limit, offset }` for pagination.

### JSON-LD injection

Blocks that produce structured data (FAQ, pricing, video) should inject JSON-LD:

```javascript
import { inject } from '../../scripts/utils/jsonld.js';

export default (el) => {
  const items = buildFaqItems(el);

  inject({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
};
```

The `jsonld.js` module accumulates all `inject()` calls into a single `@graph` in `<head>`. Site-wide schema (Organization, WebSite, WebPage, BreadcrumbList) is added automatically by `lazy.js`.

### Inter-block communication via event bus

Use the event bus when blocks need to coordinate without direct DOM coupling:

```javascript
import { emit } from '../../scripts/utils/event-bus.js';
import { on } from '../../scripts/utils/event-bus.js';

// Producer: emit('event-name', payload)
emit('filter-changed', { category: 'video' });

// Consumer: on('event-name', handler) -- returns cleanup function
const cleanup = on('filter-changed', ({ category }) => {
  filterCards(category);
});
```

Events are namespaced with `atreyu:` automatically. The bus uses standard `CustomEvent` on `document`, so browser DevTools can observe events.

### i18n with placeholders

1. Authors maintain a `/placeholders.json` spreadsheet with `Key` and `Value` columns (one per locale)
2. Blocks fetch translated strings at runtime:

```javascript
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

const label = await getPlaceholder('read-more', 'Read More');
```

The placeholder map is fetched once per locale and cached. Always provide a fallback value.

### Analytics tracking

Track user interactions from any block. Events queue during Eager/Lazy and flush when the analytics provider initializes in Delayed:

```javascript
import { track } from '../../scripts/utils/analytics.js';

el.querySelector('.cta').addEventListener('click', () => {
  track('cta_click', { block: 'hero', label: 'Sign Up' });
});
```

Each event is auto-enriched with `timestamp`, `url`, and `locale`.

### Motion-gated animations

All animations must check whether the user can tolerate motion:

```javascript
import { shouldAnimate, onReveal } from '../../scripts/utils/motion.js';

export default (el) => {
  if (shouldAnimate()) {
    el.classList.add('animate-ready');
    onReveal(el, () => el.classList.add('animate-in'));
  }
};
```

`shouldAnimate()` returns `false` if: `prefers-reduced-motion` is set, `Save-Data` is on, the connection is slower than 4G, or the device has fewer than 4 CPU cores.

### Roving tabindex for keyboard navigation

For tab-like or toolbar widgets:

```javascript
import { rovingTabindex } from '../../scripts/utils/a11y.js';

export default (el) => {
  const tabs = el.querySelectorAll('[role="tab"]');
  rovingTabindex(el, tabs, { orientation: 'horizontal', wrap: true });
};
```

Arrow keys navigate between items, Home/End jump to first/last. Returns a cleanup function.
