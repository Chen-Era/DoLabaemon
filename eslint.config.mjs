import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["desktop/**/*.cjs"],
    rules: {
      // Electron's main and preload entry points execute before the renderer
      // and must remain CommonJS because package.json has no ESM module type.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      // Rest-destructure omission (`const { contentHash: _h, ...rest } = obj`) and
      // underscore-prefixed placeholders are intentional discard patterns here.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
