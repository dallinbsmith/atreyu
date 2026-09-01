# Widgets

An escape valve for interactive UI that is genuinely too complex for plain
block authoring — not a place to put things that are merely inconvenient to
build as a block. See Vitamix's real production precedent for this exact
tier (`widgets/` layered on top of ordinary blocks for product registration,
PLP-style browsing, quizzes).

## When to reach for a widget instead of a block

- The component needs real client-side state beyond simple decoration (a
  multi-step flow, a cart, a filterable/paginated dataset).
- Authoring the content as rows/columns in a DA table would be more awkward
  for the author than useful — a widget doesn't have to map onto a document
  table the way a block does.
- You've already tried modeling it as a block and the 100-line limit in
  `.claude/rules/blocks.md` is fighting the actual shape of the problem, not
  just asking for a refactor.

If none of those are true, it's a block. Most things are a block — see
`blocks.md`'s own "minimize block usage" principle. This tier exists so that
when a real exception shows up, there's a deliberate place for it instead of
a block quietly growing past its limit or an ad-hoc script bolted onto a
page.

## Structure

- `widgets/{name}/{name}.js` + `.css` — same file-per-concern layout as
  `blocks/`, but not auto-loaded by `ak.js`'s block-loading. A widget is
  explicitly imported by whatever page/block/fragment mounts it.
- No line-count cap — a widget is allowed the complexity a block isn't, but
  keep the same house style otherwise (arrow functions, ES2025, no build
  step).
- A widget is not exempt from review, accessibility, or lint rules — only
  from the block-authoring/line-count constraints that don't fit its shape.

No widgets exist yet. This directory is scaffolding for the next time a real
one is needed, not evidence one is needed today.
