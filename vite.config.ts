import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["apps/web/src/routeTree.gen.ts"],
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc"],
    ignorePatterns: ["apps/web/src/routeTree.gen.ts"],
    categories: {
      correctness: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    env: {
      builtin: true,
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  run: {
    cache: {
      scripts: true,
    },
    tasks: {
      build: {
        command: "vp build apps/web",
        env: [
          "VITE_APP_ORIGIN",
          "DATABASE_URL",
          "BETTER_AUTH_SECRET",
          "BETTER_AUTH_URL",
          "CORS_ORIGIN",
          "VERCEL_URL",
          "VERCEL_BRANCH_URL",
          "VERCEL_PROJECT_PRODUCTION_URL",
        ],
        input: [{ auto: true }, { pattern: ".env*", base: "workspace" }],
        output: ["dist/**", ".vercel/output/**"],
      },
      dev: {
        command: "vp run -r --parallel dev",
        cache: false,
      },
      "build:web": {
        command: "vp build apps/web",
      },
      "dev:web": {
        command: "vp run --filter web dev",
        cache: false,
      },
      "db:push": {
        command: "vp run --filter @handeck/db db:push",
        cache: false,
      },
      "db:studio": {
        command: "vp run --filter @handeck/db db:studio",
        cache: false,
      },
      "db:generate": {
        command: "vp run --filter @handeck/db db:generate",
        cache: false,
      },
      "db:migrate": {
        command: "vp run --filter @handeck/db db:migrate",
        cache: false,
      },
      typecheck: {
        command: "vp run -r typecheck",
      },
      test: {
        command: "vp run -r test",
      },
      "dev:setup": {
        command: "true",
        cache: false,
      },
    },
  },
});
