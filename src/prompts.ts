import { OpenAI } from 'openai';
import { getConfig } from './commands/config';
import { i18n, I18nLocals } from './i18n';
import { configureCommitlintIntegration } from './modules/commitlint/config';
import { commitlintPrompts } from './modules/commitlint/prompts';
import { ConsistencyPrompt } from './modules/commitlint/types';
import * as utils from './modules/commitlint/utils';
import { removeConventionalCommitWord } from './utils/removeConventionalCommitWord';
import { note } from '@clack/prompts';
import { FileContext } from './utils/fileContent';

const config = getConfig();
const translation = i18n[(config.OCO_LANGUAGE as I18nLocals) || 'en'];

// ─── Format definitions ─────────────────────────────────────────────

const CONVENTIONAL_COMMIT_RULES = `You MUST follow the Conventional Commits specification strictly:

FORMAT: <type>(<scope>): <subject>

TYPES (use exactly one):
- feat: a new feature or capability
- fix: a bug fix
- docs: documentation only changes
- style: formatting, missing semi colons, etc; no code change
- refactor: code change that neither fixes a bug nor adds a feature
- perf: code change that improves performance
- test: adding or correcting tests
- build: changes to build system or external dependencies
- ci: changes to CI configuration files and scripts
- chore: other changes that don't modify src or test files
- revert: reverts a previous commit

RULES:
- The type MUST be lowercase
- The scope is optional but encouraged — use the module/file/area affected
- The subject MUST be imperative present tense ("add" not "added", "fix" not "fixed")
- The subject MUST NOT end with a period
- The subject MUST be lowercase (first letter after colon)
- The entire first line MUST be 72 characters or fewer
- Do NOT prefix with anything other than the type (no emoji, no ticket numbers)`;

const GITMOJI_RULES = `Use GitMoji convention. Preface the commit with exactly one emoji that describes the change:
🐛 Fix a bug
✨ Introduce new features
📝 Add or update documentation
🚀 Deploy stuff
✅ Add, update, or pass tests
♻️ Refactor code
⬆️ Upgrade dependencies
🔧 Add or update configuration files
🌐 Internationalization and localization
💡 Add or update comments in source code
🎨 Improve structure / format of the code
⚡️ Improve performance
🔥 Remove code or files
🚑️ Critical hotfix
💄 Add or update the UI and style files
🔒️ Fix security issues
🚨 Fix compiler / linter warnings
🚧 Work in progress
💚 Fix CI Build
⬇️ Downgrade dependencies
👷 Add or update CI build system
➕ Add a dependency
➖ Remove a dependency
✏️ Fix typos
⏪️ Revert changes
📦️ Add or update compiled files or packages
🚚 Move or rename resources
💥 Introduce breaking changes
🏷️ Add or update types
🗑️ Deprecate code that needs to be cleaned up
🧪 Add a failing test

FORMAT: <emoji> <type>(<scope>): <subject>
The commit message after the emoji must still follow conventional commit format.`;

const CUSTOM_FORMAT_INSTRUCTION = (format: string) =>
  `Use the following commit message format:\n${format}\n\nInterpret the placeholders: {type} = conventional commit type, {scope} = affected area, {subject} = imperative description of the change.`;

// ─── Prompt builder ────────────────────────────────────────────────

function getFormatRules(format: string, fullGitMojiSpec: boolean): string {
  if (format === 'gitmoji' || config.OCO_EMOJI) {
    return GITMOJI_RULES;
  }
  if (format === 'conventional' || !format) {
    return CONVENTIONAL_COMMIT_RULES;
  }
  // Custom format string
  return CUSTOM_FORMAT_INSTRUCTION(format);
}

function buildSystemPrompt(
  format: string,
  fullGitMojiSpec: boolean,
  context: string,
  fileContexts?: FileContext[]
): string {
  const language = config.OCO_LANGUAGE || 'en';
  const langName = translation?.localLanguage || 'english';

  const parts: string[] = [];

  // Identity
  parts.push(
    'You are an expert at writing git commit messages. You read diffs and produce clean, accurate commit messages.'
  );

  // Language enforcement — always English unless explicitly configured otherwise
  if (language === 'en') {
    parts.push(
      'Write the commit message in English. Do not use any other language.'
    );
  } else {
    parts.push(`Write the commit message in ${langName}.`);
  }

  // Format rules
  parts.push(getFormatRules(format, fullGitMojiSpec));

  // Scope
  if (config.OCO_OMIT_SCOPE) {
    parts.push(
      'Do NOT include a scope. Use format: <type>: <subject>'
    );
  }

  // Description
  if (config.OCO_DESCRIPTION) {
    parts.push(
      'After the commit subject line, add a blank line followed by a brief description (2-3 sentences) explaining WHY the changes were made. Do not start with "This commit".'
    );
  } else {
    parts.push(
      'Output ONLY the commit message. No description, no explanation, no markdown, no quotes.'
    );
  }

  // One line
  if (config.OCO_ONE_LINE_COMMIT) {
    parts.push(
      'Produce exactly one commit message line covering all changes. If changes span multiple areas, pick the most significant one for the scope.'
    );
  }

  // WHY
  if (config.OCO_WHY) {
    parts.push(
      'After the commit message, add a short paragraph explaining WHY these changes were made.'
    );
  }

  // File context
  if (fileContexts && fileContexts.length > 0) {
    const formatted = fileContexts
      .map((ctx) => `--- ${ctx.path} ---\n${ctx.content}`)
      .join('\n\n');
    parts.push(
      `Here is surrounding code context from the changed files to help you understand the intent:\n${formatted}`
    );
  }

  // User context
  if (context && context.trim()) {
    parts.push(
      `Additional context from the developer: ${context}`
    );
  }

  return parts.join('\n\n');
}

// ─── Example prompts for few-shot learning ─────────────────────────

export const EXAMPLE_DIFF: OpenAI.Chat.Completions.ChatCompletionMessageParam =
  {
    role: 'user',
    content: `diff --git a/src/server.ts b/src/server.ts
index ad4db42..f3b18a9 100644
--- a/src/server.ts
+++ b/src/server.ts
@@ -10,7 +10,7 @@
import {
    initWinstonLogger();

    const app = express();
    -const port = 7799;
    +const PORT = 7799;

    app.use(express.json());

@@ -34,6 +34,6 @@
    app.use((_, res, next) => {
        // ROUTES
        app.use(PROTECTED_ROUTER_URL, protectedRouter);

        -app.listen(port, () => {
            -  console.log(\`Server listening on port \${port}\`);
            +app.listen(process.env.PORT || PORT, () => {
                +  console.log(\`Server listening on port \${PORT}\`);
            });`
  };

function getExampleResponse(): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  const format = config.OCO_FORMAT || 'conventional';

  if (format === 'gitmoji' || config.OCO_EMOJI) {
    const fix = config.OCO_OMIT_SCOPE
      ? '🔧 refactor: use PORT constant and support env variable'
      : '🔧 refactor(server): use PORT constant and support env variable';

    return {
      role: 'assistant',
      content: fix
    };
  }

  const fix = config.OCO_OMIT_SCOPE
    ? 'refactor: use PORT constant and support env variable'
    : 'refactor(server): use PORT constant and support env variable';

  const feat = config.OCO_ONE_LINE_COMMIT
    ? ''
    : config.OCO_OMIT_SCOPE
      ? '\nfeat: allow server port configuration via environment variable'
      : '\nfeat(server): allow server port configuration via environment variable';

  const description = config.OCO_DESCRIPTION
    ? '\n\nRename port variable to PORT for consistency and add support for PORT environment variable to enable runtime port configuration.'
    : '';

  return {
    role: 'assistant',
    content: `${fix}${feat}${description}`.trim()
  };
}

// ─── Public API ────────────────────────────────────────────────────

export const getMainCommitPrompt = async (
  fullGitMojiSpec: boolean,
  context: string,
  fileContexts?: FileContext[]
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  const format = config.OCO_FORMAT || 'conventional';

  switch (config.OCO_PROMPT_MODULE) {
    case '@commitlint':
      if (!(await utils.commitlintLLMConfigExists())) {
        note(
          `OCO_PROMPT_MODULE is @commitlint but you haven't generated consistency for this project yet.`
        );
        await configureCommitlintIntegration();
      }

      const commitLintConfig = await utils.getCommitlintLLMConfig();

      return [
        commitlintPrompts.INIT_MAIN_PROMPT(
          translation.localLanguage,
          commitLintConfig.prompts
        ),
        EXAMPLE_DIFF,
        {
          role: 'assistant',
          content:
            (
              commitLintConfig.consistency[
                translation.localLanguage
              ] as ConsistencyPrompt
            )?.commitFix || 'fix(server): use PORT constant'
        }
      ];

    default:
      return [
        {
          role: 'system',
          content: buildSystemPrompt(
            format,
            fullGitMojiSpec,
            context,
            fileContexts
          )
        },
        EXAMPLE_DIFF,
        getExampleResponse()
      ];
  }
};

// Re-export for backward compatibility
export const IDENTITY =
  'You are an expert at writing git commit messages.';
export const INIT_DIFF_PROMPT = EXAMPLE_DIFF;
