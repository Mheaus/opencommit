# Providers

OpenCommit supports multiple AI providers. Configure via `oco setup` (interactive wizard) or `oco config set`.

## Claude Code (recommended — no API key)

Uses the `claude` CLI directly. Requires a Claude Pro or Max subscription.

```sh
oco config set OCO_AI_PROVIDER=claude-code
oco config set OCO_MODEL=sonnet   # haiku | sonnet | opus
```

The model name maps to the Claude CLI `--model` alias. No API key needed.

**Streaming:** Claude Code streams its output — you'll see thinking blocks (when the model produces them) and the commit message appear live while it's generated.

## Ollama (local, free)

Runs models locally via [Ollama](https://ollama.ai).

```sh
ollama pull llama3:8b       # pull model once
oco config set OCO_AI_PROVIDER=ollama
oco config set OCO_MODEL=llama3:8b
# optional: custom endpoint (default: http://localhost:11434)
oco config set OCO_API_URL=http://192.168.1.10:11434
```

## OpenAI

```sh
oco config set OCO_AI_PROVIDER=openai
oco config set OCO_API_KEY=sk-...
oco config set OCO_MODEL=gpt-4o-mini
```

## Anthropic

```sh
oco config set OCO_AI_PROVIDER=anthropic
oco config set OCO_API_KEY=sk-ant-...
oco config set OCO_MODEL=claude-3-5-haiku-20241022
```

## Other providers

| Provider | `OCO_AI_PROVIDER` value |
|---|---|
| Google Gemini | `gemini` |
| Groq | `groq` |
| Mistral | `mistral` |
| DeepSeek | `deepseek` |
| OpenRouter | `openrouter` |
| AI/ML API | `aimlapi` |
| Azure OpenAI | `azure` |
| Flowise | `flowise` |
| MLX (Apple Silicon) | `mlx` |

All follow the same pattern: `OCO_AI_PROVIDER=<value>`, `OCO_API_KEY=<key>`, `OCO_MODEL=<model>`.
