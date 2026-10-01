# Asset placement

Where a visual asset lives depends on how it is consumed, not its file type.

| Category | Location | Example |
|---|---|---|
| Icon an author types as `:name:` in DA | `icons/{name}.svg`, flat. `ak.js` fetches `/icons/{name}.svg` at a fixed path | `icons/` |
| Code-owned media used by one block | Flat in the block's own folder, next to its `.js`/`.css` | `blocks/footer-glow/bookend-glow.mp4` |
| Code-owned media shared by several blocks, or looked up by a purpose-built helper | `img/{category}/`, never loose in `img/` | `img/favicons/`, `img/partners/` (name-keyed lookup in `partner-logo.js`) |

How to decide between `icons/` and `img/` for an SVG: if an author inserts it inline with `:name:`, it's an icon. If code fetches it through a feature-specific lookup, it belongs in `img/`.

UI chrome (chevrons, close, play, check):

- Always a `.svg` file, never a JS string or CSS data URI.
- One block's chrome sits flat next to that block; chrome shared by two or more blocks sits in `img/glyphs/`.
- Paint it with a CSS mask (`background-color` token + `mask: url(...)`). Use `loadSvg()` from `scripts/utils/glyphs.js` only when you need real SVG nodes (path-level CSS or a GSAP target).

Exception: `blocks/hero-cards-transition/posters/` keeps a 10-file fallback set in a subfolder so it isn't mistaken for block source. Otherwise don't create subfolders inside a block.
