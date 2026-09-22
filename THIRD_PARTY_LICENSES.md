# Third-Party Licensed Assets

This file records third-party assets embedded in this repository that are
covered by a license other than this project's own `LICENSE`, along with the
basis for including them. `styles/fonts/OFL.txt` already covers Montserrat
(SIL Open Font License) — this file exists for assets that aren't openly
licensed and need an explicit, discoverable authorization record instead of
relying solely on inline code comments.

## PP Neue Machina Inktrap (Regular)

- **File**: `styles/fonts/NeueMachinaInktrap.woff` (64,004 bytes)
- **Foundry**: Pangram Pangram Foundry
- **Real font name**: "PP Neue Machina Inktrap Regular" (PostScript name
  `PPNeueMachinaInktrapRegular`), a single 400/Regular weight
- **Source**: downloaded directly from Frame.io's own production site,
  `https://frame.io/_next/static/media/19874d4df76220a9-s.p.woff`
  (confirmed byte-identical via SHA-256 against the file in this repo:
  `a6bf322bd64d93d1242a9d713e4ff7a25993cdfc0767a3c095f6ea84d069154e`)
- **Used for**: the header mega-menu's eyebrow labels ("PRODUCT",
  "INDUSTRIES", etc.) and per-item counter numerals ("01", "02", ...) in
  `blocks/header/header.css`, via the `--font-tertiary` token in
  `styles/styles.css`
- **Licensing basis**: this repository is Frame.io's own Edge Delivery
  Services migration project — the intended successor to the production
  site the font was sourced from, under the same company/brand, not a
  separate third party. Use here is authorized on that basis.
- **Authorization**: confirmed by Dallin Smith (project owner, Adobe/Frame.io
  migration), 2026-09-22, in response to a direct question about whether
  this migration project has licensing coverage for Frame.io's production
  brand fonts.
- **Scope of this authorization**: this specific font, for this specific
  use, in this specific project. This is not a standing precedent for
  copying other third-party or commercial assets from production without
  the same explicit, one-time confirmation.

See `styles/fonts.css` and `blocks/header/header.css` for the corresponding
inline comments at the actual `@font-face` and usage sites.
