# Handeck — Agent Guidelines

## What is this project?

**Handeck** is a Chinese language learning app built as a Bun monorepo with Vite+ task orchestration. It helps users look up words in a CC-CEDICT dictionary, build study templates, and generate flashcard decks from vocabulary and example sentences.

| Area            | Location               | Stack                                                |
| --------------- | ---------------------- | ---------------------------------------------------- |
| Web app         | `apps/web`             | React, TanStack Start, TanStack Router, Tailwind CSS |
| Shared UI       | `packages/ui`          | shadcn/ui components and design tokens               |
| API             | `packages/api`         | oRPC procedures for app and external integrations    |
| Database        | `packages/db`          | Drizzle ORM + PostgreSQL schema/client               |
| Dictionary data | `packages/cedict-data` | CC-CEDICT seeding and parsing                        |
| Auth            | `packages/auth`        | Better Auth with Drizzle adapter                     |

## Package manager: Bun, not npm

This repo uses **Bun** as the package manager and **Vite+** (`vp`) for dev, build, lint, format, test, and workspace task orchestration. Always prefer:

- Install dependencies: `vp install` (or `bun install`)
- Run scripts: `vp run <task>` for workspace tasks (`vp run dev`, `vp run build`, `vp run db:push`), or root scripts such as `bun run full-check`
- App dev/build: `vp dev apps/web`, `vp build apps/web`, or `vp run --filter web dev`
- Run a package binary: `bunx <command>` instead of `npx`

Do **not** use `npm install`, `npm run`, or `npx` unless a third-party tool explicitly requires it and there is no Bun equivalent.

## TypeScript: avoid explicit return types

Prefer **type inference**. Do not add explicit function return types unless they are truly needed, for example:

- A public API boundary where the exported signature must stay stable
- Inference is wrong or too wide and cannot be fixed another way
- A recursive or otherwise complex type that inference cannot resolve

Let TypeScript infer return types for components, helpers, oRPC handlers, and internal functions.

## Format code after every change

After editing files, **always format** before finishing:

```bash
vp fmt
```

To verify formatting, lint, types, and tests together:

```bash
vp check
vp run -r typecheck
vp run -r test
```

Or use the root `full-check` script, which runs those steps in sequence. Formatting and linting are handled by **Vite+** (`vp fmt`, `vp lint`). Run format on every change set you touch, not only at the end of a large task.
