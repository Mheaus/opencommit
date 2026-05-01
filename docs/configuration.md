# Configuration Reference

Config is stored in `~/.opencommit` (global) or a `.env` file at the project root (local, takes priority).

Set values with:
```sh
oco config set KEY=value
oco config get KEY
oco config describe KEY   # shows accepted values
```

---

## Provider & model

| Key | Default | Description |
|---|---|---|
| `OCO_AI_PROVIDER` | `openai` | AI provider to use. See [providers.md](./providers.md) for all options. |
| `OCO_MODEL` | `gpt-4o-mini` | Model name for the configured provider. |
| `OCO_API_KEY` | — | API key. Not required for `claude-code`, `ollama`, `mlx`. |
| `OCO_API_URL` | — | Custom endpoint URL (Ollama, Azure, proxies). |
| `OCO_API_CUSTOM_HEADERS` | — | JSON string of extra HTTP headers. |
| `OCO_TOKENS_MAX_INPUT` | `4096` | Max tokens to send in a request. |
| `OCO_TOKENS_MAX_OUTPUT` | `500` | Max tokens in the model response. |

## Routing

| Key | Default | Description |
|---|---|---|
| `OCO_MODEL_ROUTING` | `true` | Enable smart routing by diff complexity. |
| `OCO_MODEL_SMALL` | — | Model override for simple diffs (single-provider routing). |
| `OCO_MODEL_LARGE` | — | Model override for complex diffs (single-provider routing). |
| `OCO_LOCAL_PROVIDER` | — | Local provider for tiered routing (e.g. `ollama`). |
| `OCO_LOCAL_MODEL_SMALL` | — | Local model for simple diffs. |
| `OCO_LOCAL_MODEL_MEDIUM` | — | Local model for moderate diffs. |
| `OCO_LOCAL_MODEL_LARGE` | — | Local model for complex diffs. |
| `OCO_FALLBACK_PROVIDER` | — | Cloud fallback provider for tiered routing. |
| `OCO_FALLBACK_MODEL_SMALL` | — | Fallback model for simple diffs. |
| `OCO_FALLBACK_MODEL_MEDIUM` | — | Fallback model for moderate diffs. |
| `OCO_FALLBACK_MODEL_LARGE` | — | Fallback model for complex diffs. |
| `OCO_FILE_CONTEXT` | `true` | Read full file content for complex diffs to improve context. |

## Commit message format

| Key | Default | Description |
|---|---|---|
| `OCO_FORMAT` | `conventional` | Commit format: `conventional`, `gitmoji`, or a custom template string. |
| `OCO_EMOJI` | `false` | Prefix commit with a GitMoji. |
| `OCO_DESCRIPTION` | `false` | Add a 3-sentence description body after the commit subject. |
| `OCO_WHY` | `false` | Append a short explanation of why the changes were made. |
| `OCO_ONE_LINE_COMMIT` | `false` | Enforce a single-line message (no body). |
| `OCO_LANGUAGE` | `en` | Language for generated messages (e.g. `fr`, `de`, `ja`). |
| `OCO_OMIT_SCOPE` | `false` | Omit the `(scope)` part from conventional commit messages. |
| `OCO_SCOPES` | — | Comma-separated list of allowed scopes (e.g. `auth,api,ui`). |
| `OCO_MESSAGE_TEMPLATE_PLACEHOLDER` | `$msg` | Placeholder replaced by the generated message in template mode. |
| `OCO_PROMPT_MODULE` | `conventional-commit` | Prompt strategy: `conventional-commit` or `@commitlint`. |

## Behaviour

| Key | Default | Description |
|---|---|---|
| `OCO_GITPUSH` | `true` | Prompt to push after committing. |
| `OCO_HOOK_AUTO_UNCOMMENT` | `false` | Auto-uncomment commit message lines when running as a git hook. |

---

## CLI flags

Flags passed to `oco` override config for that run.

| Flag | Description |
|---|---|
| `--context`, `-c` | Extra context for the AI (e.g. ticket number, feature name). |
| `--yes`, `-y` | Skip confirmation prompt and commit immediately. |
| `--format`, `-f` | Override `OCO_FORMAT` for this run. |
| `--fgm` | Use the full GitMoji specification (requires `OCO_EMOJI=true`). |

Any extra arguments are forwarded to `git commit` (e.g. `oco --no-verify`, `oco --signoff`).
