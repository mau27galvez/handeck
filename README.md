# handeck

## Tech stack

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **PostgreSQL + Drizzle** - Database schema and client in `packages/db`
- **oRPC** - API procedures for app calls and external integrations
- **Authentication** - Better Auth
- **Vite+** - Unified toolchain (`vp`) for dev, build, lint, format, test, and workspace tasks

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Set up environment

Create `apps/web/.env` from `apps/web/.env.example`, then fill in the Postgres URL and Better Auth settings.

Push the Drizzle schema to your database:

```bash
vp run db:push
```

Start the whole project together:

```bash
vp run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@handeck/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Git Hooks and Formatting

- Check types, formatting and lint: `vp check` (or `bun run check`)
- Format files: `vp fmt` (or `bun run format`)

## Project Structure

```
handeck/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
├── packages/
│   ├── api/         # oRPC procedures
│   ├── auth/        # Better Auth configuration
│   ├── db/          # Drizzle PostgreSQL schema and client
│   ├── ui/          # Shared shadcn/ui components and styles
```
