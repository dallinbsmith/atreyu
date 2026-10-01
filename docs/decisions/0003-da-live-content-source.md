# 0003. DA (da.live) is the content source

**Status:** Accepted.

## Context

EDS can read content from SharePoint, Google Drive or Adobe's Document Authoring (DA). Adobe is moving DA onto a new backend; there is no sanctioned path from SharePoint to it.

## Decision

Content is authored in DA. `fstab.yaml` mounts `https://content.da.live/dallinbsmith/atreyu/`.

## Consequences

- Pages, fragments, sheets (placeholders, redirects, metadata) and the block Library are DA documents, edited independently of code ([authoring/da-content-structure.md](../authoring/da-content-structure.md)).
- The org `dallinbsmith/atreyu` is a sandbox. Moving to a Frame.io-owned DA org changes `fstab.yaml`, the Worker's `AEM_ORG`/`AEM_SITE`, and every `dallinbsmith` host in this repo.
- When DA moves to its new backend, plan for: lossless content export, re-checking author permissions, and stale content in the admin API right after the switch.
