import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" },
      ],
    },
  },
  {
    files: [
      "app/api/internal/**/*.{ts,tsx}",
      "app/api/account/**/*.{ts,tsx}",
      "app/api/billing/**/*.{ts,tsx}",
      "lib/internal/**/*.{ts,tsx}",
      "lib/actions/coach-chat.ts",
      "lib/services/coach-llm-prompts.ts",
      "lib/services/ai-context.builder.ts",
      "lib/services/memory-engine.service.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default eslintConfig;
