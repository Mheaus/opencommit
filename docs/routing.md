# Smart Model Routing

OpenCommit analyses each diff before calling the AI and routes to the right model based on complexity. This keeps simple commits cheap and fast, while complex ones get a capable model.

## How complexity is determined

| Level | Criteria |
|---|---|
| **simple** | ≤ 2 files, ≤ 50 changed lines — or rename-only, or config/docs only |
| **moderate** | ≤ 5 files, ≤ 200 lines, no critical paths |
| **complex** | Many files, large diffs, touches auth/migrations/API routes, or multiple languages |

The routing label is shown after generation:

```
✔ Commit message generated (simple diff -> llama3:8b)
```

## Single-provider routing

Route across model sizes within one provider using `OCO_MODEL_SMALL` and `OCO_MODEL_LARGE`:

```sh
oco config set OCO_AI_PROVIDER=openai
oco config set OCO_MODEL=gpt-4o-mini        # moderate (default)
oco config set OCO_MODEL_SMALL=gpt-4o-mini  # simple
oco config set OCO_MODEL_LARGE=gpt-4o       # complex
```

Toggle routing on/off:

```sh
oco config set OCO_MODEL_ROUTING=false   # always use OCO_MODEL
oco config set OCO_MODEL_ROUTING=true    # default
```

## Tiered local + fallback routing

The most powerful setup: use a **local model** (Ollama, MLX) for simple and moderate diffs, fall back to a **cloud model** for complex ones.

### Interactive setup

```sh
oco routing
```

This wizard asks you to configure:
- Local provider + small / medium / large model
- Fallback provider + small / medium / large model

### Manual config

```sh
# Local tier (Ollama)
oco config set OCO_LOCAL_PROVIDER=ollama
oco config set OCO_LOCAL_MODEL_SMALL=llama3:8b
oco config set OCO_LOCAL_MODEL_MEDIUM=llama3:70b
oco config set OCO_LOCAL_MODEL_LARGE=llama3:70b

# Fallback tier (Claude Code)
oco config set OCO_FALLBACK_PROVIDER=claude-code
oco config set OCO_FALLBACK_MODEL_SMALL=haiku
oco config set OCO_FALLBACK_MODEL_MEDIUM=sonnet
oco config set OCO_FALLBACK_MODEL_LARGE=sonnet
```

### How fallback works

For each complexity tier, the local model is tried first. If that tier has no local model configured, the fallback provider is used automatically. There is no runtime retry — the decision is made at routing time based on what's configured.

```
simple diff  → OCO_LOCAL_MODEL_SMALL  (or OCO_FALLBACK_MODEL_SMALL if not set)
moderate diff → OCO_LOCAL_MODEL_MEDIUM (or OCO_FALLBACK_MODEL_MEDIUM if not set)
complex diff  → OCO_LOCAL_MODEL_LARGE  (or OCO_FALLBACK_MODEL_LARGE if not set)
```

## File context

For complex diffs, OpenCommit reads the full content of changed files (up to 2000 tokens) to give the model more context. Disable with:

```sh
oco config set OCO_FILE_CONTEXT=false
```
