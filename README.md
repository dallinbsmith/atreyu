# Atreyu: Frame.io marketing site on AEM Edge Delivery Services

This repository is the migration of frame.io's marketing site from Next.js + Sanity + Vercel to Adobe Edge Delivery Services (EDS). Content is authored in DA (da.live). A Cloudflare Worker in front of frame.io will move traffic to EDS one group of URLs at a time.

**Status: pre-production.** Nothing here serves frame.io traffic yet. Code and content run on `main--atreyu--dallinbsmith.aem.page` (preview) and `.aem.live` (published); content lives in a sandbox DA org (`dallinbsmith/atreyu`). Details: [docs/status.md](docs/status.md).

## Quick start

```sh
git clone https://github.com/dallinbsmith/atreyu.git
cd atreyu
npm install                       # Node 22+
npm install -g @adobe/aem-cli     # once
aem up                            # http://localhost:3000
```

```sh
npm run lint                      # must pass before every commit
npm test                          # Web Test Runner
```

More: [docs/runbooks/local-development.md](docs/runbooks/local-development.md).

## Documentation

| | |
|---|---|
| [docs/README.md](docs/README.md) | Start here: access, map of the docs, terms |
| [docs/architecture/](docs/architecture/overview.md) | How the site, Worker, locales and personalization work |
| [docs/authoring/](docs/authoring/block-catalog.md) | DA content structure, block catalog, Section Metadata |
| [docs/conventions/](docs/conventions/README.md) | Coding rules for JS, CSS, blocks, the Worker and tests |
| [docs/runbooks/](docs/runbooks/worker.md) | Local dev, Worker deploy and rollback, releasing |
| [docs/decisions/](docs/decisions/README.md) | Decision records |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, PRs, required checks, review |
| [AGENTS.md](AGENTS.md) | Instructions for AI coding agents |
