/**
 * Integration tests for the commit generation pipeline.
 * Uses the test AI engine to verify the full flow without real API calls.
 */

import { analyzeDiffComplexity, DiffComplexity } from '../../src/utils/complexity';
import { routeModel, ModelRouterConfig } from '../../src/utils/modelRouter';
import { shouldReadFileContent } from '../../src/utils/fileContent';

describe('commit generation pipeline', () => {
  const smallDiff = `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,3 @@
-# Old Title
+# New Title
`;

  const moderateDiff = (() => {
    const lines: string[] = [];
    for (let i = 0; i < 4; i++) {
      lines.push(`diff --git a/src/file${i}.ts b/src/file${i}.ts`);
      lines.push('index 1234567..abcdefg 100644');
      lines.push(`--- a/src/file${i}.ts`);
      lines.push(`+++ b/src/file${i}.ts`);
      lines.push('@@ -1,10 +1,15 @@');
      for (let j = 0; j < 15; j++) lines.push(`+line ${j}`);
      for (let j = 0; j < 10; j++) lines.push(`-old ${j}`);
    }
    return lines.join('\n');
  })();

  const complexDiff = (() => {
    const lines: string[] = [];
    const files = [
      'src/api/routes.ts', 'src/middleware/auth.ts', 'src/models/user.ts',
      'src/services/email.py', 'src/utils/crypto.go', 'src/db/schema.ts',
      'src/controllers/admin.ts'
    ];
    for (const file of files) {
      lines.push(`diff --git a/${file} b/${file}`);
      lines.push('index 1234567..abcdefg 100644');
      lines.push(`--- a/${file}`);
      lines.push(`+++ b/${file}`);
      lines.push('@@ -1,50 +1,80 @@');
      for (let j = 0; j < 40; j++) {
        lines.push(`+new line ${j}`);
        lines.push(`-old line ${j}`);
      }
    }
    return lines.join('\n');
  })();

  describe('end-to-end complexity -> routing -> file context', () => {
    it('simple diff uses small model and skips file context', () => {
      const analysis = analyzeDiffComplexity(smallDiff);
      expect(analysis.level).toBe(DiffComplexity.SIMPLE);

      const routerConfig: ModelRouterConfig = {
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
        enabled: true
      };
      const model = routeModel(analysis.level, routerConfig);
      expect(model).toBe('gpt-4o-mini');

      const readFiles = shouldReadFileContent(analysis.level, true);
      expect(readFiles).toBe(false);
    });

    it('moderate diff uses default model and skips file context', () => {
      const analysis = analyzeDiffComplexity(moderateDiff);
      expect(analysis.level).toBe(DiffComplexity.MODERATE);

      const routerConfig: ModelRouterConfig = {
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
        enabled: true
      };
      const model = routeModel(analysis.level, routerConfig);
      expect(model).toBe('gpt-4o-mini');

      const readFiles = shouldReadFileContent(analysis.level, true);
      expect(readFiles).toBe(false);
    });

    it('complex diff uses large model and reads file context', () => {
      const analysis = analyzeDiffComplexity(complexDiff);
      expect(analysis.level).toBe(DiffComplexity.COMPLEX);

      const routerConfig: ModelRouterConfig = {
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
        enabled: true
      };
      const model = routeModel(analysis.level, routerConfig);
      expect(model).toBe('gpt-4o');

      const readFiles = shouldReadFileContent(analysis.level, true);
      expect(readFiles).toBe(true);
    });

    it('complex diff with routing disabled uses default model', () => {
      const analysis = analyzeDiffComplexity(complexDiff);

      const routerConfig: ModelRouterConfig = {
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
        enabled: false
      };
      const model = routeModel(analysis.level, routerConfig);
      expect(model).toBe('gpt-4o-mini');
    });

    it('complex diff with file context disabled skips reading', () => {
      const analysis = analyzeDiffComplexity(complexDiff);
      const readFiles = shouldReadFileContent(analysis.level, false);
      expect(readFiles).toBe(false);
    });
  });

  describe('provider-specific routing', () => {
    const providers = [
      { name: 'openai', small: 'gpt-4o-mini', large: 'gpt-4o' },
      { name: 'anthropic', small: 'claude-3-5-haiku-20241022', large: 'claude-sonnet-4-20250514' },
      { name: 'gemini', small: 'gemini-1.5-flash', large: 'gemini-1.5-pro' },
      { name: 'mistral', small: 'ministral-8b-latest', large: 'mistral-large-latest' }
    ];

    for (const p of providers) {
      it(`${p.name}: routes simple -> ${p.small}, complex -> ${p.large}`, () => {
        const config: ModelRouterConfig = {
          provider: p.name,
          defaultModel: p.small,
          enabled: true
        };
        expect(routeModel(DiffComplexity.SIMPLE, config)).toBe(p.small);
        expect(routeModel(DiffComplexity.COMPLEX, config)).toBe(p.large);
      });
    }
  });
});
