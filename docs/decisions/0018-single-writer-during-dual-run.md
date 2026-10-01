# 0018. One writable source per page and locale during the migration

**Status:** Accepted. Not yet enforced.

## Decision

While a page exists both on the current site (Sanity) and in DA, only one system is writable for each (page, locale, migration state). When a cell moves to EDS, its pages become read-only in Sanity. Pages whose locale is still on the current site stay editable there until their own cell moves. The read-only side is enforced with permissions, not by asking editors.

## Consequences

- Moving a cell to EDS includes a content freeze step for exactly that cell.
- Sync during the window is one-way, current site → DA.
