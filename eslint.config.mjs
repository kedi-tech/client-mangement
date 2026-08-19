import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

// `eslint-config-next` is still published in eslintrc format, so it is bridged
// into flat config rather than imported directly.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "prisma/migrations/**",
    ],
  },

  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    // Type-aware rules need a file the TypeScript project actually includes, so
    // they are scoped to the app's own sources.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Underscore-prefixed arguments are the codebase's convention for the
      // values a signature must accept but does not use — `_prev` in every
      // server action that backs a form, for instance.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Authorisation depends on these being awaited: `cookies()`, `headers()`
      // and every `requireUser()` guard are async, and a forgotten `await`
      // yields a truthy Promise that would sail past a permission check.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // `describe()` and `it()` from node:test return promises the runner owns; the
  // suite is not meant to await them.
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },

  // Build config files are plain ESM outside the TypeScript project.
  {
    files: ["**/*.mjs", "**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
