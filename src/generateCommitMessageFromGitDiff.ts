import { select, confirm, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import { OpenAI } from 'openai';
import {
  DEFAULT_TOKEN_LIMITS,
  getConfig,
  setGlobalConfig,
  getGlobalConfig,
  MODEL_LIST,
  RECOMMENDED_MODELS
} from './commands/config';
import { getMainCommitPrompt } from './prompts';
import { getEngine } from './utils/engine';
import {
  isModelNotFoundError,
  getSuggestedModels,
  ModelNotFoundError
} from './utils/errors';
import { mergeDiffs } from './utils/mergeDiffs';
import { tokenCount } from './utils/tokenCount';
import { analyzeDiffComplexity, DiffComplexity } from './utils/complexity';
import { routeModel, routeProvider, routeTiered, formatRoutingInfo, ModelRouterConfig, TieredRoutingConfig } from './utils/modelRouter';
import {
  shouldReadFileContent,
  readFileContexts,
  FileContext
} from './utils/fileContent';

const ADJUSTMENT_FACTOR = 20;

/**
 * Ensures we always return a single commit message.
 * When OCO_DESCRIPTION or OCO_WHY are enabled the AI is allowed to add a body
 * after a blank line — in that case we keep subject + body.
 * Otherwise we take only the first non-empty line.
 */
function extractFirstLine(message: string): string {
  const config = getConfig();
  if (config.OCO_DESCRIPTION || config.OCO_WHY) {
    return message.trim();
  }
  const first = message.trim().split('\n').find((l) => l.trim().length > 0);
  return first?.trim() || message.trim();
}

export enum GenerateCommitMessageErrorEnum {
  tooMuchTokens = 'TOO_MUCH_TOKENS',
  internalError = 'INTERNAL_ERROR',
  emptyMessage = 'EMPTY_MESSAGE',
  outputTokensTooHigh = `Token limit exceeded, OCO_TOKENS_MAX_OUTPUT must not be much higher than the default ${DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT} tokens.`
}

async function handleModelNotFoundError(
  error: Error,
  provider: string,
  currentModel: string
): Promise<string | null> {
  console.log(chalk.red(`\n✖ Model '${currentModel}' not found\n`));

  const suggestedModels = getSuggestedModels(provider, currentModel);
  const recommended =
    RECOMMENDED_MODELS[provider as keyof typeof RECOMMENDED_MODELS];

  if (suggestedModels.length === 0) {
    console.log(
      chalk.yellow(
        `No alternative models available. Run 'oco setup' to configure a different model.`
      )
    );
    return null;
  }

  const options: Array<{ value: string; label: string }> = [];

  if (recommended && suggestedModels.includes(recommended)) {
    options.push({
      value: recommended,
      label: `${recommended} (Recommended)`
    });
  }

  suggestedModels
    .filter((m) => m !== recommended)
    .forEach((model) => {
      options.push({ value: model, label: model });
    });

  options.push({ value: '__custom__', label: 'Enter custom model...' });

  const selection = await select({
    message: 'Select an alternative model:',
    options
  });

  if (isCancel(selection)) return null;

  let newModel: string;
  if (selection === '__custom__') {
    const { text } = await import('@clack/prompts');
    const customModel = await text({
      message: 'Enter model name:',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Model name is required';
        }
        return undefined;
      }
    });

    if (isCancel(customModel)) return null;
    newModel = customModel as string;
  } else {
    newModel = selection as string;
  }

  const saveAsDefault = await confirm({
    message: 'Save as default model?'
  });

  if (!isCancel(saveAsDefault) && saveAsDefault) {
    const existingConfig = getGlobalConfig();
    setGlobalConfig({
      ...existingConfig,
      OCO_MODEL: newModel
    } as any);
    console.log(chalk.green('✔') + ' Model saved as default\n');
  }

  return newModel;
}

const generateCommitMessageChatCompletionPrompt = async (
  diff: string,
  fullGitMojiSpec: boolean,
  context: string,
  fileContexts?: FileContext[]
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(
    fullGitMojiSpec,
    context,
    fileContexts
  );

  return [...INIT_MESSAGES_PROMPT, { role: 'user', content: diff }];
};

export interface GenerateOptions {
  diff: string;
  fullGitMojiSpec?: boolean;
  context?: string;
  retryWithModel?: string;
}

export const generateCommitMessageByDiff = async ({
  diff,
  fullGitMojiSpec = false,
  context = '',
  retryWithModel
}: GenerateOptions): Promise<{
  message: string;
  model: string;
  complexity: DiffComplexity;
}> => {
  const currentConfig = getConfig();
  const provider = currentConfig.OCO_AI_PROVIDER || 'openai';
  const MAX_TOKENS_INPUT = currentConfig.OCO_TOKENS_MAX_INPUT;
  const MAX_TOKENS_OUTPUT = currentConfig.OCO_TOKENS_MAX_OUTPUT;

  // 1. Analyze diff complexity
  const analysis = analyzeDiffComplexity(diff);

  // 2. Route to appropriate model + provider
  const routingEnabled = currentConfig.OCO_MODEL_ROUTING ?? true;
  let selectedModel: string;
  let selectedProvider: string | undefined;

  if (!retryWithModel && (currentConfig.OCO_LOCAL_PROVIDER || currentConfig.OCO_FALLBACK_PROVIDER)) {
    // Tiered local/fallback routing
    const tieredConfig: TieredRoutingConfig = {
      enabled: routingEnabled,
      defaultProvider: provider,
      defaultModel: currentConfig.OCO_MODEL,
      local: currentConfig.OCO_LOCAL_PROVIDER ? {
        provider: currentConfig.OCO_LOCAL_PROVIDER,
        small: currentConfig.OCO_LOCAL_MODEL_SMALL,
        medium: currentConfig.OCO_LOCAL_MODEL_MEDIUM,
        large: currentConfig.OCO_LOCAL_MODEL_LARGE
      } : undefined,
      fallback: currentConfig.OCO_FALLBACK_PROVIDER ? {
        provider: currentConfig.OCO_FALLBACK_PROVIDER,
        small: currentConfig.OCO_FALLBACK_MODEL_SMALL,
        medium: currentConfig.OCO_FALLBACK_MODEL_MEDIUM,
        large: currentConfig.OCO_FALLBACK_MODEL_LARGE
      } : undefined
    };
    const routed = routeTiered(analysis.level, tieredConfig);
    selectedModel = routed.model;
    selectedProvider = routed.provider !== provider ? routed.provider : undefined;
  } else {
    // Legacy single-provider model routing
    const routerConfig: ModelRouterConfig = {
      provider,
      defaultModel: retryWithModel || currentConfig.OCO_MODEL,
      smallModel: currentConfig.OCO_MODEL_SMALL,
      largeModel: currentConfig.OCO_MODEL_LARGE,
      smallProvider: currentConfig.OCO_PROVIDER_SMALL,
      largeProvider: currentConfig.OCO_PROVIDER_LARGE,
      enabled: routingEnabled
    };
    selectedModel = retryWithModel || routeModel(analysis.level, routerConfig);
    selectedProvider = retryWithModel ? undefined : routeProvider(analysis.level, routerConfig);
  }

  // 3. Optionally read file content for complex diffs
  let fileContexts: FileContext[] = [];
  if (shouldReadFileContent(analysis.level, currentConfig.OCO_FILE_CONTEXT ?? true)) {
    try {
      fileContexts = await readFileContexts(diff, 2000);
    } catch {
      // Non-critical, proceed without file context
    }
  }

  try {
    const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(
      fullGitMojiSpec,
      context,
      fileContexts
    );

    const INIT_MESSAGES_PROMPT_LENGTH = INIT_MESSAGES_PROMPT.map(
      (msg) => tokenCount(msg.content as string) + 4
    ).reduce((a, b) => a + b, 0);

    const MAX_REQUEST_TOKENS =
      MAX_TOKENS_INPUT -
      ADJUSTMENT_FACTOR -
      INIT_MESSAGES_PROMPT_LENGTH -
      MAX_TOKENS_OUTPUT;

    if (tokenCount(diff) >= MAX_REQUEST_TOKENS) {
      const commitMessagePromises = await getCommitMsgsPromisesFromFileDiffs(
        diff,
        MAX_REQUEST_TOKENS,
        fullGitMojiSpec,
        selectedModel,
        selectedProvider
      );

      // Take only the first successful result for a single clean commit
      for (const promise of commitMessagePromises) {
        const msg = await promise;
        if (msg) {
          return {
            message: extractFirstLine(msg),
            model: selectedModel,
            complexity: analysis.level
          };
        }
        await delay(500);
      }

      throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);
    }

    const messages = await generateCommitMessageChatCompletionPrompt(
      diff,
      fullGitMojiSpec,
      context,
      fileContexts
    );

    const engine = getEngine(selectedModel, selectedProvider);
    const commitMessage = await engine.generateCommitMessage(messages);

    if (!commitMessage)
      throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);

    const displayModel = selectedProvider
      ? `${selectedProvider}:${selectedModel}`
      : selectedModel;

    return {
      message: extractFirstLine(commitMessage),
      model: displayModel,
      complexity: analysis.level
    };
  } catch (error) {
    if (isModelNotFoundError(error)) {
      const newModel = await handleModelNotFoundError(
        error as Error,
        provider,
        selectedModel
      );

      if (newModel) {
        console.log(chalk.cyan(`Retrying with ${newModel}...\n`));
        const existingConfig = getGlobalConfig();
        setGlobalConfig({
          ...existingConfig,
          OCO_MODEL: newModel
        } as any);

        return generateCommitMessageByDiff({
          diff,
          fullGitMojiSpec,
          context,
          retryWithModel: newModel
        });
      }
    }

    throw error;
  }
};

function getMessagesPromisesByChangesInFile(
  fileDiff: string,
  separator: string,
  maxChangeLength: number,
  fullGitMojiSpec: boolean,
  model?: string,
  provider?: string
) {
  const hunkHeaderSeparator = '@@ ';
  const [fileHeader, ...fileDiffByLines] = fileDiff.split(hunkHeaderSeparator);

  const mergedChanges = mergeDiffs(
    fileDiffByLines.map((line) => hunkHeaderSeparator + line),
    maxChangeLength
  );

  const lineDiffsWithHeader: string[] = [];
  for (const change of mergedChanges) {
    const totalChange = fileHeader + change;
    if (tokenCount(totalChange) > maxChangeLength) {
      const splitChanges = splitDiff(totalChange, maxChangeLength);
      lineDiffsWithHeader.push(...splitChanges);
    } else {
      lineDiffsWithHeader.push(totalChange);
    }
  }

  const engine = getEngine(model, provider);
  return lineDiffsWithHeader.map(async (lineDiff) => {
    const messages = await generateCommitMessageChatCompletionPrompt(
      separator + lineDiff,
      fullGitMojiSpec,
      ''
    );
    return engine.generateCommitMessage(messages);
  });
}

function splitDiff(diff: string, maxChangeLength: number) {
  const lines = diff.split('\n');
  const splitDiffs: string[] = [];
  let currentDiff = '';

  if (maxChangeLength <= 0) {
    throw new Error(GenerateCommitMessageErrorEnum.outputTokensTooHigh);
  }

  for (let line of lines) {
    while (tokenCount(line) > maxChangeLength) {
      const subLine = line.substring(0, maxChangeLength);
      line = line.substring(maxChangeLength);
      splitDiffs.push(subLine);
    }

    if (tokenCount(currentDiff) + tokenCount('\n' + line) > maxChangeLength) {
      splitDiffs.push(currentDiff);
      currentDiff = line;
    } else {
      currentDiff += '\n' + line;
    }
  }

  if (currentDiff) {
    splitDiffs.push(currentDiff);
  }

  return splitDiffs;
}

export const getCommitMsgsPromisesFromFileDiffs = async (
  diff: string,
  maxDiffLength: number,
  fullGitMojiSpec: boolean,
  model?: string,
  provider?: string
) => {
  const separator = 'diff --git ';

  const diffByFiles = diff.split(separator).slice(1);

  const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

  const commitMessagePromises: Promise<string | null | undefined>[] = [];

  for (const fileDiff of mergedFilesDiffs) {
    if (tokenCount(fileDiff) >= maxDiffLength) {
      const messagesPromises = getMessagesPromisesByChangesInFile(
        fileDiff,
        separator,
        maxDiffLength,
        fullGitMojiSpec,
        model,
        provider
      );
      commitMessagePromises.push(...messagesPromises);
    } else {
      const messages = await generateCommitMessageChatCompletionPrompt(
        separator + fileDiff,
        fullGitMojiSpec,
        ''
      );
      const engine = getEngine(model, provider);
      commitMessagePromises.push(engine.generateCommitMessage(messages));
    }
  }

  return commitMessagePromises;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
