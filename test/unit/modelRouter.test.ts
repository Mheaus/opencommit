import { routeModel, formatRoutingInfo, PROVIDER_MODEL_TIERS, ModelRouterConfig } from '../../src/utils/modelRouter';
import { DiffComplexity } from '../../src/utils/complexity';

describe('routeModel', () => {
  const baseConfig: ModelRouterConfig = {
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    enabled: true
  };

  it('routes SIMPLE diffs to the small model', () => {
    const model = routeModel(DiffComplexity.SIMPLE, baseConfig);
    expect(model).toBe('gpt-4o-mini');
  });

  it('routes MODERATE diffs to the default (medium) model', () => {
    const model = routeModel(DiffComplexity.MODERATE, baseConfig);
    expect(model).toBe('gpt-4o-mini');
  });

  it('routes COMPLEX diffs to the large model', () => {
    const model = routeModel(DiffComplexity.COMPLEX, baseConfig);
    expect(model).toBe('gpt-4o');
  });

  it('respects custom smallModel override', () => {
    const model = routeModel(DiffComplexity.SIMPLE, {
      ...baseConfig,
      smallModel: 'gpt-3.5-turbo'
    });
    expect(model).toBe('gpt-3.5-turbo');
  });

  it('respects custom largeModel override', () => {
    const model = routeModel(DiffComplexity.COMPLEX, {
      ...baseConfig,
      largeModel: 'gpt-4-turbo'
    });
    expect(model).toBe('gpt-4-turbo');
  });

  it('returns defaultModel when routing is disabled', () => {
    const model = routeModel(DiffComplexity.COMPLEX, {
      ...baseConfig,
      enabled: false
    });
    expect(model).toBe('gpt-4o-mini');
  });

  it('returns defaultModel for providers without tier definitions', () => {
    const model = routeModel(DiffComplexity.COMPLEX, {
      provider: 'ollama',
      defaultModel: 'llama3',
      enabled: true
    });
    expect(model).toBe('llama3');
  });

  it('works correctly for anthropic provider', () => {
    const config: ModelRouterConfig = {
      provider: 'anthropic',
      defaultModel: 'claude-sonnet-4-20250514',
      enabled: true
    };
    expect(routeModel(DiffComplexity.SIMPLE, config)).toBe('claude-3-5-haiku-20241022');
    expect(routeModel(DiffComplexity.MODERATE, config)).toBe('claude-sonnet-4-20250514');
    expect(routeModel(DiffComplexity.COMPLEX, config)).toBe('claude-sonnet-4-20250514');
  });

  it('works correctly for gemini provider', () => {
    const config: ModelRouterConfig = {
      provider: 'gemini',
      defaultModel: 'gemini-1.5-flash',
      enabled: true
    };
    expect(routeModel(DiffComplexity.SIMPLE, config)).toBe('gemini-1.5-flash');
    expect(routeModel(DiffComplexity.COMPLEX, config)).toBe('gemini-1.5-pro');
  });
});

describe('formatRoutingInfo', () => {
  it('formats simple routing info', () => {
    const info = formatRoutingInfo(DiffComplexity.SIMPLE, 'gpt-4o-mini');
    expect(info).toBe('simple diff -> gpt-4o-mini');
  });

  it('formats complex routing info', () => {
    const info = formatRoutingInfo(DiffComplexity.COMPLEX, 'gpt-4o');
    expect(info).toBe('complex diff -> gpt-4o');
  });
});

describe('PROVIDER_MODEL_TIERS', () => {
  it('has tiers defined for major providers', () => {
    const expectedProviders = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'deepseek', 'openrouter', 'aimlapi'];
    for (const provider of expectedProviders) {
      expect(PROVIDER_MODEL_TIERS[provider]).toBeDefined();
      expect(PROVIDER_MODEL_TIERS[provider].small).toBeDefined();
      expect(PROVIDER_MODEL_TIERS[provider].medium).toBeDefined();
      expect(PROVIDER_MODEL_TIERS[provider].large).toBeDefined();
    }
  });
});
