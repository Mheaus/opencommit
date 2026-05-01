import { intro, outro, select, text, confirm, isCancel, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { COMMANDS } from './ENUMS';
import {
  CONFIG_KEYS,
  OCO_AI_PROVIDER_ENUM,
  getGlobalConfig,
  setGlobalConfig
} from './config';
import { fetchOllamaModels } from '../utils/modelCache';

const LOCAL_PROVIDERS = [
  { value: OCO_AI_PROVIDER_ENUM.OLLAMA, label: 'Ollama (local, free)' },
  { value: OCO_AI_PROVIDER_ENUM.MLX, label: 'MLX (Apple Silicon, local)' }
];

const FALLBACK_PROVIDERS = [
  { value: OCO_AI_PROVIDER_ENUM.CLAUDE_CODE, label: 'Claude Code (your Claude plan, no API key)' },
  { value: OCO_AI_PROVIDER_ENUM.ANTHROPIC, label: 'Anthropic API' },
  { value: OCO_AI_PROVIDER_ENUM.OPENAI, label: 'OpenAI' },
  { value: OCO_AI_PROVIDER_ENUM.GROQ, label: 'Groq' },
  { value: OCO_AI_PROVIDER_ENUM.GEMINI, label: 'Google Gemini' },
  { value: OCO_AI_PROVIDER_ENUM.MISTRAL, label: 'Mistral AI' },
  { value: OCO_AI_PROVIDER_ENUM.DEEPSEEK, label: 'DeepSeek' }
];

const CLAUDE_CODE_MODELS = ['haiku', 'sonnet', 'opus'];
const ANTHROPIC_MODELS = ['claude-3-5-haiku-20241022', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514'];
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'];
const GROQ_MODELS = ['llama3-8b-8192', 'llama3-70b-8192'];
const GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro'];
const MISTRAL_MODELS = ['ministral-8b-latest', 'mistral-small-latest', 'mistral-large-latest'];
const DEEPSEEK_MODELS = ['deepseek-chat'];

function modelsForProvider(provider: string): string[] {
  switch (provider) {
    case OCO_AI_PROVIDER_ENUM.CLAUDE_CODE: return CLAUDE_CODE_MODELS;
    case OCO_AI_PROVIDER_ENUM.ANTHROPIC: return ANTHROPIC_MODELS;
    case OCO_AI_PROVIDER_ENUM.OPENAI: return OPENAI_MODELS;
    case OCO_AI_PROVIDER_ENUM.GROQ: return GROQ_MODELS;
    case OCO_AI_PROVIDER_ENUM.GEMINI: return GEMINI_MODELS;
    case OCO_AI_PROVIDER_ENUM.MISTRAL: return MISTRAL_MODELS;
    case OCO_AI_PROVIDER_ENUM.DEEPSEEK: return DEEPSEEK_MODELS;
    default: return [];
  }
}

async function pickModel(
  provider: string,
  tierLabel: string,
  ollamaModels: string[]
): Promise<string | null> {
  const isOllama = provider === OCO_AI_PROVIDER_ENUM.OLLAMA || provider === OCO_AI_PROVIDER_ENUM.MLX;

  if (isOllama) {
    const options = ollamaModels.length > 0
      ? [
          ...ollamaModels.map((m) => ({ value: m, label: m })),
          { value: '__custom__', label: 'Enter custom model name...' },
          { value: '__skip__', label: `Skip (no ${tierLabel} tier)` }
        ]
      : [
          { value: '__custom__', label: 'Enter model name manually' },
          { value: '__skip__', label: `Skip (no ${tierLabel} tier)` }
        ];

    const choice = await select({ message: `Local ${tierLabel} model:`, options });
    if (isCancel(choice) || choice === '__skip__') return null;

    if (choice === '__custom__') {
      const val = await text({
        message: `Enter ${tierLabel} model name:`,
        placeholder: tierLabel === 'small' ? 'llama3:8b' : tierLabel === 'medium' ? 'llama3:70b' : 'llama3:70b'
      });
      if (isCancel(val)) return null;
      return val as string;
    }

    return choice as string;
  }

  // Cloud provider
  const models = modelsForProvider(provider);
  const options = [
    ...models.map((m) => ({ value: m, label: m })),
    { value: '__custom__', label: 'Enter custom model name...' },
    { value: '__skip__', label: `Skip (no ${tierLabel} tier)` }
  ];

  const choice = await select({ message: `Fallback ${tierLabel} model:`, options });
  if (isCancel(choice) || choice === '__skip__') return null;

  if (choice === '__custom__') {
    const val = await text({ message: `Enter ${tierLabel} model name:` });
    if (isCancel(val)) return null;
    return val as string;
  }

  return choice as string;
}

export async function runRoutingSetup(): Promise<boolean> {
  intro(chalk.bgCyan(' Model Routing Setup '));

  console.log(chalk.dim(
    '  Map diff complexity → model tier:\n' +
    '  simple diff → small model\n' +
    '  moderate diff → medium model\n' +
    '  complex diff → large model\n'
  ));

  const config: Partial<Record<string, any>> = {};

  // ── Local provider ──────────────────────────────────────────────────────────
  const wantsLocal = await confirm({ message: 'Configure a local provider? (Ollama, MLX)' });
  if (isCancel(wantsLocal)) { outro('Cancelled'); return false; }

  let ollamaModels: string[] = [];

  if (wantsLocal) {
    const localProvider = await select({
      message: 'Local provider:',
      options: LOCAL_PROVIDERS
    });
    if (isCancel(localProvider)) { outro('Cancelled'); return false; }

    config[CONFIG_KEYS.OCO_LOCAL_PROVIDER] = localProvider;

    // Fetch Ollama models if available
    if (localProvider === OCO_AI_PROVIDER_ENUM.OLLAMA) {
      const s = spinner();
      s.start('Checking local Ollama...');
      try {
        ollamaModels = await fetchOllamaModels('http://localhost:11434');
        s.stop(ollamaModels.length > 0
          ? `${chalk.green('✔')} Found ${ollamaModels.length} model(s)`
          : chalk.yellow('Ollama running but no models found'));
      } catch {
        s.stop(chalk.yellow('Ollama not running — enter model names manually'));
      }
    }

    const small = await pickModel(localProvider as string, 'small', ollamaModels);
    if (small) config[CONFIG_KEYS.OCO_LOCAL_MODEL_SMALL] = small;

    const medium = await pickModel(localProvider as string, 'medium', ollamaModels);
    if (medium) config[CONFIG_KEYS.OCO_LOCAL_MODEL_MEDIUM] = medium;

    const large = await pickModel(localProvider as string, 'large', ollamaModels);
    if (large) config[CONFIG_KEYS.OCO_LOCAL_MODEL_LARGE] = large;
  }

  // ── Fallback provider ───────────────────────────────────────────────────────
  const wantsFallback = await confirm({ message: 'Configure a fallback provider? (used when local tier is missing or fails)' });
  if (isCancel(wantsFallback)) { outro('Cancelled'); return false; }

  if (wantsFallback) {
    const fallbackProvider = await select({
      message: 'Fallback provider:',
      options: FALLBACK_PROVIDERS
    });
    if (isCancel(fallbackProvider)) { outro('Cancelled'); return false; }

    config[CONFIG_KEYS.OCO_FALLBACK_PROVIDER] = fallbackProvider;

    const small = await pickModel(fallbackProvider as string, 'small', []);
    if (small) config[CONFIG_KEYS.OCO_FALLBACK_MODEL_SMALL] = small;

    const medium = await pickModel(fallbackProvider as string, 'medium', []);
    if (medium) config[CONFIG_KEYS.OCO_FALLBACK_MODEL_MEDIUM] = medium;

    const large = await pickModel(fallbackProvider as string, 'large', []);
    if (large) config[CONFIG_KEYS.OCO_FALLBACK_MODEL_LARGE] = large;
  }

  if (!wantsLocal && !wantsFallback) {
    outro('Nothing configured — no changes saved.');
    return true;
  }

  // Save
  const existing = getGlobalConfig();
  setGlobalConfig({ ...existing, ...config } as any);

  // Summary
  console.log('');
  if (config[CONFIG_KEYS.OCO_LOCAL_PROVIDER]) {
    const p = config[CONFIG_KEYS.OCO_LOCAL_PROVIDER];
    console.log(chalk.bold('  Local:') + ` ${p}`);
    const s = config[CONFIG_KEYS.OCO_LOCAL_MODEL_SMALL];
    const m = config[CONFIG_KEYS.OCO_LOCAL_MODEL_MEDIUM];
    const l = config[CONFIG_KEYS.OCO_LOCAL_MODEL_LARGE];
    if (s) console.log(`    simple   → ${chalk.cyan(s)}`);
    if (m) console.log(`    moderate → ${chalk.cyan(m)}`);
    if (l) console.log(`    complex  → ${chalk.cyan(l)}`);
  }
  if (config[CONFIG_KEYS.OCO_FALLBACK_PROVIDER]) {
    const p = config[CONFIG_KEYS.OCO_FALLBACK_PROVIDER];
    console.log(chalk.bold('  Fallback:') + ` ${p}`);
    const s = config[CONFIG_KEYS.OCO_FALLBACK_MODEL_SMALL];
    const m = config[CONFIG_KEYS.OCO_FALLBACK_MODEL_MEDIUM];
    const l = config[CONFIG_KEYS.OCO_FALLBACK_MODEL_LARGE];
    if (s) console.log(`    simple   → ${chalk.cyan(s)}`);
    if (m) console.log(`    moderate → ${chalk.cyan(m)}`);
    if (l) console.log(`    complex  → ${chalk.cyan(l)}`);
  }
  console.log('');

  outro(`${chalk.green('✔')} Routing configuration saved`);
  return true;
}

export const routingCommand = command(
  {
    name: COMMANDS.routing,
    help: { description: 'Configure local/fallback model routing by diff complexity' }
  },
  async () => {
    await runRoutingSetup();
  }
);
