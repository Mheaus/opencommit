/**
 * Smart model routing: picks the right model tier based on diff complexity.
 * Small/cheap models for trivial commits, larger models when it matters.
 */

import { OCO_AI_PROVIDER_ENUM } from '../commands/config';
import { DiffComplexity } from './complexity';

export interface ModelTiers {
  small: string;
  medium: string;
  large: string;
}

/**
 * Default model tiers per provider.
 * small = fastest/cheapest, for trivial changes
 * medium = balanced (the default model most users configure)
 * large = most capable, for complex cross-cutting changes
 */
export const PROVIDER_MODEL_TIERS: Record<string, ModelTiers> = {
  [OCO_AI_PROVIDER_ENUM.OPENAI]: {
    small: 'gpt-4o-mini',
    medium: 'gpt-4o-mini',
    large: 'gpt-4o'
  },
  [OCO_AI_PROVIDER_ENUM.ANTHROPIC]: {
    small: 'claude-3-5-haiku-20241022',
    medium: 'claude-sonnet-4-20250514',
    large: 'claude-sonnet-4-20250514'
  },
  [OCO_AI_PROVIDER_ENUM.GEMINI]: {
    small: 'gemini-1.5-flash',
    medium: 'gemini-1.5-flash',
    large: 'gemini-1.5-pro'
  },
  [OCO_AI_PROVIDER_ENUM.GROQ]: {
    small: 'llama3-8b-8192',
    medium: 'llama3-70b-8192',
    large: 'llama3-70b-8192'
  },
  [OCO_AI_PROVIDER_ENUM.MISTRAL]: {
    small: 'ministral-8b-latest',
    medium: 'mistral-small-latest',
    large: 'mistral-large-latest'
  },
  [OCO_AI_PROVIDER_ENUM.DEEPSEEK]: {
    small: 'deepseek-chat',
    medium: 'deepseek-chat',
    large: 'deepseek-chat'
  },
  [OCO_AI_PROVIDER_ENUM.OPENROUTER]: {
    small: 'openai/gpt-4o-mini',
    medium: 'openai/gpt-4o-mini',
    large: 'openai/gpt-4o'
  },
  [OCO_AI_PROVIDER_ENUM.AIMLAPI]: {
    small: 'gpt-4o-mini',
    medium: 'gpt-4o-mini',
    large: 'openai/gpt-4o'
  }
};

export interface ModelRouterConfig {
  provider: string;
  /** User's configured default model */
  defaultModel: string;
  /** Override for small tier */
  smallModel?: string;
  /** Override for large tier */
  largeModel?: string;
  /** Whether routing is enabled */
  enabled: boolean;
}

/**
 * Select the appropriate model based on diff complexity.
 * Returns the model name to use.
 */
export function routeModel(
  complexity: DiffComplexity,
  config: ModelRouterConfig
): string {
  if (!config.enabled) {
    return config.defaultModel;
  }

  const providerTiers = PROVIDER_MODEL_TIERS[config.provider];

  // If provider has no tiers defined (ollama, mlx, flowise, etc.), use default
  if (!providerTiers) {
    return config.defaultModel;
  }

  const tiers: ModelTiers = {
    small: config.smallModel || providerTiers.small,
    medium: config.defaultModel || providerTiers.medium,
    large: config.largeModel || providerTiers.large
  };

  switch (complexity) {
    case DiffComplexity.SIMPLE:
      return tiers.small;
    case DiffComplexity.MODERATE:
      return tiers.medium;
    case DiffComplexity.COMPLEX:
      return tiers.large;
    default:
      return tiers.medium;
  }
}

/**
 * Format model routing info for display.
 */
export function formatRoutingInfo(
  complexity: DiffComplexity,
  model: string
): string {
  const labels: Record<DiffComplexity, string> = {
    [DiffComplexity.SIMPLE]: 'simple',
    [DiffComplexity.MODERATE]: 'moderate',
    [DiffComplexity.COMPLEX]: 'complex'
  };

  return `${labels[complexity]} diff -> ${model}`;
}
