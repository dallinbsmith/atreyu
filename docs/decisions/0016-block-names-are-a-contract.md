# 0016. Block names and variant tokens are a contract with content

**Status:** Accepted.

## Decision

A block's name and its authored variant tokens are part of the content contract. Renaming or removing one needs a new decision record and a content migration that rewrites every DA document and the Library. A back-compat shim stays until a crawl shows zero uses.

## Consequences

- Prefer adding a variant over changing an existing one.
- Provisional blocks may be renamed freely until real content uses them.
- Catalog and stability status: [authoring/block-catalog.md](../authoring/block-catalog.md).
