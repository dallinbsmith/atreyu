# Conventions

Rules every change follows. Each file applies to the paths named at its top.

| File | Covers |
|---|---|
| [javascript.md](javascript.md) | Language rules and lint, loading phases, `ak.js`/AK-PATCHES, block lifecycle, shared utilities, fetches, event tracking, selectors, state, security |
| [blocks.md](blocks.md) | Block init contract, row classification, structure, variants, content and copy, Library Sync |
| [css.md](css.md) | File architecture, cascade layers, tokens, z-index, nesting, Section Metadata |
| [workers.md](workers.md) | Cloudflare Worker rules |
| [testing.md](testing.md) | Lint and test commands, CI, writing tests, pre-commit hook |
| [accessibility.md](accessibility.md) | WCAG 2.1 AA rules |
| [assets.md](assets.md) | Where icons, images and media live |

## Old references

Some code comments and commit messages cite documents that are not in this repository. Use this table to find the current equivalent.

| Cited as | Read instead |
|---|---|
| `CLAUDE.md` | [AGENTS.md](../../AGENTS.md), [javascript.md](javascript.md) |
| `scripts.md`, `.claude/rules/scripts.md` | [javascript.md](javascript.md) |
| `blocks.md`, `.claude/rules/blocks.md` | [blocks.md](blocks.md) |
| `css.md`, `.claude/rules/css.md` | [css.md](css.md) |
| `linting.md`, `.claude/rules/linting.md` | [javascript.md](javascript.md#language), [testing.md](testing.md) |
| `workers.md`, `accessibility.md`, `assets.md` under `.claude/rules/` | The file of the same name here |
| `DA-CONTENT-STRUCTURE.md` | [authoring/da-content-structure.md](../authoring/da-content-structure.md) |
| `block-catalog.md` | [authoring/block-catalog.md](../authoring/block-catalog.md) |
| `tools/sidekick/blocks.md` | [authoring/block-catalog.md](../authoring/block-catalog.md), [authoring/section-metadata.md](../authoring/section-metadata.md) |
| `locale-i18n-plan.md` | [architecture/locale.md](../architecture/locale.md) |
| `PLAN.md` (personalization) | [architecture/personalization.md](../architecture/personalization.md) |
| `ARCHITECTURE-DECISIONS.md`, `adr-00N-*.md` | [decisions/](../decisions/README.md) |
| `foundation-hardening-plan.md` | [status.md](../status.md) |
| An ID such as `F-66`, `P0-48`, `D-L5`, `A2` | Internal tracking IDs. Where the decision matters, it is in [decisions/](../decisions/README.md#legacy-ids) |
