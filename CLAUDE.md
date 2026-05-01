# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

OpenCommit (`oco`) is a CLI tool that auto-generates meaningful git commit messages using AI. It stages files, analyzes the diff, calls an AI provider, and commits — with interactive prompts at each step.

## Commands

```bash
# Build (bundles to out/cli.cjs via esbuild)
npm run build

# Watch mode during development
npm run watch

# Run directly with ts-node (no build needed)
npm run dev

# Lint (ESLint + TypeScript type-check)
npm run lint

# Format
npm run format

# Run unit tests
npm test
# or
npm run test:unit

# Run a single test file
NODE_OPTIONS=--experimental-vm-modules npx jest test/unit/complexity.test.ts

# E2E tests (requires Docker)
npm run test:e2e:docker
```

Config is stored in `~/.opencommit` as an INI file. During development you can set env vars like `OCO_AI_PROVIDER=ollama npm run dev`.

## Architecture

### Entry point
`src/cli.ts` — parses CLI flags with `cleye`, runs migrations, checks for first-run setup, then calls `commit()`.

### Core commit flow
`src/commands/commit.ts` → `src/generateCommitMessageFromGitDiff.ts`

1. Get staged files / prompt user to stage
2. Analyze diff complexity (`src/utils/complexity.ts`) → SIMPLE / MODERATE / COMPLEX
3. Route to a model tier based on complexity (`src/utils/modelRouter.ts`)
4. Optionally read file context for complex diffs (`src/utils/fileContent.ts`)
5. Build prompt (`src/prompts.ts`) and call the AI engine
6. Present message to user → Yes / Edit / Regenerate / Cancel
7. Commit (with pre-commit hook passthrough if applicable) and optionally push

### AI engine abstraction
`src/engine/Engine.ts` defines the `AiEngine` interface. `src/utils/engine.ts#getEngine()` is the factory that maps `OCO_AI_PROVIDER` config to the right class.

Engines: `openAi`, `anthropic`, `gemini`, `azure`, `groq`, `mistral`, `deepseek`, `ollama`, `mlx`, `flowise`, `openrouter`, `aimlapi`, `claude-code` (uses Claude Code CLI directly without an API key).

All engines implement `generateCommitMessage(messages)` with OpenAI-compatible message format.

### Configuration
`src/commands/config.ts` owns all config keys (`CONFIG_KEYS` enum), defaults, validation, and the `oco config get/set/describe` subcommand. Config is read by `getConfig()` which merges global `~/.opencommit`, local `.env`, and environment variables.

Key config keys for features on this branch:
- `OCO_MODEL_ROUTING` — enables smart model routing
- `OCO_MODEL_SMALL` / `OCO_MODEL_LARGE` — override routing tiers
- `OCO_FILE_CONTEXT` — enables reading file content for complex diffs
- `OCO_FORMAT` — commit format (`conventional`, `gitmoji`, or custom template)
- `OCO_SCOPES` — allowed conventional commit scopes

### Migrations
`src/migrations/` — numbered migration files run at startup via `src/migrations/_run.ts`. Add new migrations as `NN_description.ts`.

### Git hooks
`src/commands/githook.ts` — installs/uninstalls `oco` as a `prepare-commit-msg` git hook. `src/commands/prepare-commit-msg-hook.ts` handles the hook execution path.

### Prompt building
`src/prompts.ts` builds the system/user message array. Supports conventional commits, gitmoji (full or compact spec), custom format templates, optional description/why fields, and i18n.

### Token management
`src/utils/tokenCount.ts` counts tokens (tiktoken). When a diff exceeds the input limit, `generateCommitMessageFromGitDiff.ts` splits by file and merges diffs (`src/utils/mergeDiffs.ts`) to stay within limits.

## Build output

The build produces a single `out/cli.cjs` CommonJS bundle (via `esbuild.config.js`). The tiktoken WASM binary is copied alongside it. This is what gets published to npm.
