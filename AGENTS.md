# Codex Instructions

This repository is `aim-web-agents`, the future web-agent monorepo for Real Estate AIM.

## Before Editing

- Check the current repository state before making changes.
- Read the relevant local docs before changing architecture or workflow files.
- Treat `aim-docs` as canonical. If this repository conflicts with `aim-docs`, `aim-docs` wins.

## Repository Boundaries

- Do not modify sibling repositories from this repo.
- Do not modify `aim-docs`.
- Do not modify `aim-hub`.
- Do not modify `aim-mobile-agents`.
- Do not duplicate AIM Hub responsibilities.

## Product Code

- Do not create product code unless the task explicitly says so.
- Do not create a Next.js app unless the task explicitly says so.
- Do not import existing apps without an explicit import task.
- Do not create API routes unless the task explicitly says so.
- Do not add provider integrations unless the task explicitly says so.

## Secrets And Environment

- Do not expose secrets.
- Do not create environment files unless the task explicitly says so.
- Do not commit credentials, tokens, provider keys, session data, or private configuration.

## Hub Boundary

AIM Hub owns identity, wallet, credits, profile, properties, jobs, assets, ledger, storage, sharing, timeline, and workspace state.

Web agents may generate, edit, and preview outputs. Durable state should flow back through Hub-owned workflows.

## Reporting

- Report changed files.
- Report whether product code, dependencies, environment files, or secrets were created.
- Commit and push only when safe and explicitly within task scope.
- Do not force push.
- Do not reset the repository.
