# Onboarding

This runbook is for external contributors and new project contributors.

## Before day 1

A project maintainer prepares access.

| Access | Needed for |
|---|---|
| GitHub repository access with Write | Branches and PRs |
| Adobe ID for DA | Content work |
| DA path permissions | Editing assigned pages, sheets, and drafts |
| EDS role with preview only for contributors | Previewing content without publishing |
| AEM Sidekick browser extension | Preview and authoring tools |
| Named reviewer | PR review and content handoff |

Do not grant more access than the task needs.

## Day 1: setup and reading

Follow [local development](local-development.md):

```sh
git clone https://github.com/dallinbsmith/atreyu.git
cd atreyu
npm install
aem up
npm run lint
npm test
```

Read in this order:

1. [docs/README.md](../README.md)
2. [architecture overview](../architecture/overview.md)
3. [environments](../architecture/environments.md)
4. [conventions](../conventions/README.md)
5. [CONTRIBUTING.md](../../CONTRIBUTING.md)
6. [definition of done](../contributing/definition-of-done.md)
7. [AGENTS.md](../../AGENTS.md), if using AI tools

## Day 2: first code PR loop

1. Create a short branch, for example `docs/first-doc-fix` or `fix/card-spacing`.
2. Make a small scoped change.
3. Push the branch.
4. Add Test URLs to the PR: Before `https://main--atreyu--<owner>.aem.live/<path>` and After `https://<branch>--atreyu--<owner>.aem.live/<path>`. `<owner>` is defined in [environments.md](../architecture/environments.md#owner-placeholder).
5. Add evidence required by the PR template.
6. Request review.
7. After merge, verify the affected path on `https://main--atreyu--<owner>.aem.live/<path>`.

## Day 2: first content task

1. Port one page under `/drafts/<name>/` in DA.
2. Preview it with Sidekick.
3. Fix visible issues.
4. Hand it to a publisher for review and publish.

Contributors do not publish production content unless a maintainer explicitly grants that role for the task.
