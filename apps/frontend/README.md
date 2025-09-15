# Frontend Application

A modern Next.js 15 application with TypeScript, Tailwind CSS v4, Biome.js, and React Query.

## Tech Stack

- **Next.js v15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS v4** - Utility-first CSS framework
- **Biome.js** - Fast linter and formatter
- **React Query (TanStack Query)** - Powerful data synchronization
- **pnpm** - Fast, disk space efficient package manager

## Getting Started

### Development

From the project root:

```bash
# Start development server
pnpm frontend:dev

# Or using turbo
pnpm turbo dev --filter=@repo/frontend
```

From this directory:

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Code Quality

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type checking
pnpm typecheck
```

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── globals.css      # Global styles with Tailwind CSS v4
│   ├── layout.tsx       # Root layout with providers
│   └── page.tsx         # Home page
└── providers/           # React providers
    ├── index.tsx        # Main providers wrapper
    └── query-provider.tsx # React Query provider
```

## Features

- **App Router**: Using Next.js 15 App Router for modern routing
- **React Query**: Pre-configured with sensible defaults and devtools
- **Tailwind CSS v4**: Latest version with new features and syntax
- **Biome.js**: Fast linting and formatting instead of ESLint + Prettier
- **TypeScript**: Strict type checking with workspace integration
- **Workspace Integration**: Fully integrated with pnpm workspace and turbo

## Configuration

- **TypeScript**: Extends base config from workspace root
- **Tailwind**: Configured for v4 with PostCSS
- **Biome**: Comprehensive linting and formatting rules
- **React Query**: Optimized caching and error handling defaults
