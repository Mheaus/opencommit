# Quickstart

## Install

```sh
npm install -g opencommit
```

Or clone and link the dev build:

```sh
git clone <repo>
cd opencommit
npm install && npm run build && npm link
```

## First run

Run `oco` in any git repository. On the first run a setup wizard starts automatically:

```sh
cd my-project
git add .
oco
```

The wizard asks for your provider and API key, then commits.

## With Claude (no API key)

If you have a Claude Pro or Max subscription, use the `claude-code` provider — no API key needed:

```sh
oco setup   # pick "Claude Code" in the list
# or manually:
oco config set OCO_AI_PROVIDER=claude-code OCO_MODEL=sonnet
```

Requires the `claude` CLI to be installed and authenticated: `npm install -g @anthropic-ai/claude-code`.

## With Ollama (fully local, free)

```sh
ollama pull llama3:8b
oco setup   # pick "Ollama" in the list
# or manually:
oco config set OCO_AI_PROVIDER=ollama OCO_MODEL=llama3:8b
```

## With local + cloud fallback

Use a local model for quick commits and fall back to Claude for complex changes:

```sh
oco routing
```

The wizard configures three model tiers (small / medium / large) for both your local provider and a cloud fallback. See [routing.md](./routing.md) for details.

## Common commands

```sh
oco                          # stage everything and commit
oco --yes                    # commit without confirmation prompt
oco --context "fixes #42"    # add context hint for the AI
oco setup                    # re-run provider setup wizard
oco routing                  # configure smart model routing
oco config set KEY=value     # set a config value
oco config describe          # list all config keys
oco hook set                 # install as git prepare-commit-msg hook
oco models                   # list available models for current provider
```
