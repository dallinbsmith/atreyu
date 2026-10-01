# 0009. Dedicated CRO authoring and results tools: on hold

**Status:** On hold. A minimal scope is allowed.

## Context

A design existed for a DA app to author tests, a Sidekick panel for live results, and Worker endpoints for reach and results data.

## Decision

That build is on hold. Allowed now: the Personalize table, its compiler, and the experiments panel (a Sidekick panel that lists the tests and personalization on a page). Not allowed without a new decision: a test-authoring app, live results, any warehouse access from the Worker.

## Consequences

- Don't add `/cro/*` endpoints, warehouse credentials or a CRO DA app.
- The experiments panel is read-only and lives in `experiments-panel/`.
