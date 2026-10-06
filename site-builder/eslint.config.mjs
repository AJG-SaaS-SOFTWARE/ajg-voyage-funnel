import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals"],
  }),
  {
    files: ["tests/**/*.{js,mjs,cjs,ts,tsx}"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
    ],
  },
];

export default eslintConfig;
