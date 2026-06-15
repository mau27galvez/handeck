import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      test: {
        command: "vp test run",
      },
      typecheck: {
        command: "tsc --noEmit",
      },
    },
  },
});
