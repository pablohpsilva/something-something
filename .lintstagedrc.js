module.exports = {
  // TypeScript and JavaScript files
  "**/*.{ts,tsx,js,jsx,mjs,cjs}": [
    "biome check --apply --no-errors-on-unmatched",
    "biome format --write --no-errors-on-unmatched",
  ],

  // JSON files
  "**/*.json": ["biome format --write --no-errors-on-unmatched"],

  // Package.json files (special handling)
  "**/package.json": ["biome format --write --no-errors-on-unmatched"],

  // Prisma schema files
  "**/*.prisma": ["prisma format"],

  // Markdown files (optional formatting)
  "**/*.md": ["biome format --write --no-errors-on-unmatched"],
};
