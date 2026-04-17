import {
  text,
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  spinner
} from '@clack/prompts';
import chalk from 'chalk';
import { execa } from 'execa';
import {
  generateCommitMessageByDiff,
  GenerateOptions
} from '../generateCommitMessageFromGitDiff';
import {
  formatUserFriendlyError,
  printFormattedError
} from '../utils/errors';
import {
  assertGitRepo,
  getChangedFiles,
  getDiff,
  getStagedFiles,
  gitAdd,
  hasActivePreCommitHook,
  skipsHooks
} from '../utils/git';
import { trytm } from '../utils/trytm';
import { getConfig } from './config';
import { formatRoutingInfo } from '../utils/modelRouter';
import { logSession, logSessionSeparator } from '../utils/sessionLogger';

const config = getConfig();

const getGitRemotes = async () => {
  const { stdout } = await execa('git', ['remote']);
  return stdout.split('\n').filter((remote) => Boolean(remote.trim()));
};

const checkMessageTemplate = (extraArgs: string[]): string | false => {
  for (const key in extraArgs) {
    if (extraArgs[key].includes(config.OCO_MESSAGE_TEMPLATE_PLACEHOLDER))
      return extraArgs[key];
  }
  return false;
};

interface GenerateCommitMessageFromGitDiffParams {
  diff: string;
  extraArgs: string[];
  context?: string;
  fullGitMojiSpec?: boolean;
  skipCommitConfirmation?: boolean;
}

const generateCommitMessageFromGitDiff = async ({
  diff,
  extraArgs,
  context = '',
  fullGitMojiSpec = false,
  skipCommitConfirmation = false
}: GenerateCommitMessageFromGitDiffParams): Promise<void> => {
  await assertGitRepo();
  logSessionSeparator();
  logSession('START', 'generating commit message');
  const s = spinner();
  s.start('Generating commit message');

  try {
    const result = await generateCommitMessageByDiff({
      diff,
      fullGitMojiSpec,
      context
    });

    let commitMessage = result.message;
    logSession('GENERATED', `model=${result.model} complexity=${result.complexity}`);

    const messageTemplate = checkMessageTemplate(extraArgs);
    if (
      config.OCO_MESSAGE_TEMPLATE_PLACEHOLDER &&
      typeof messageTemplate === 'string'
    ) {
      const messageTemplateIndex = extraArgs.indexOf(messageTemplate);
      extraArgs.splice(messageTemplateIndex, 1);
      commitMessage = messageTemplate.replace(
        config.OCO_MESSAGE_TEMPLATE_PLACEHOLDER,
        commitMessage
      );
    }

    // Show routing info when model routing is active
    const routingLabel =
      config.OCO_MODEL_ROUTING
        ? ` ${chalk.dim(`(${formatRoutingInfo(result.complexity, result.model)})`)}`
        : '';

    s.stop(`Commit message generated${routingLabel}`);

    outro(
      `${chalk.grey('─'.repeat(50))}\n${commitMessage}\n${chalk.grey('─'.repeat(50))}`
    );

    const userAction = skipCommitConfirmation
      ? 'Yes'
      : await select({
          message: 'Commit?',
          options: [
            { value: 'Yes', label: 'Yes' },
            { value: 'Edit', label: 'Edit' },
            { value: 'Regenerate', label: 'Regenerate' },
            { value: 'No', label: 'Cancel' }
          ]
        });

    if (isCancel(userAction) || userAction === 'No') {
      outro('Cancelled');
      process.exit(0);
    }

    logSession('USER_ACTION', userAction as string);

    if (userAction === 'Edit') {
      const textResponse = await text({
        message: 'Edit commit message:',
        initialValue: commitMessage
      });

      if (isCancel(textResponse)) process.exit(1);
      commitMessage = textResponse.toString();
    }

    if (userAction === 'Regenerate') {
      await generateCommitMessageFromGitDiff({
        diff,
        extraArgs,
        context,
        fullGitMojiSpec
      });
      return;
    }

    // Commit
    logSession('COMMIT', commitMessage.split('\n')[0]);

    const hooksWillRun =
      !skipsHooks(extraArgs) && (await hasActivePreCommitHook());

    let commitSummary: string;

    if (hooksWillRun) {
      process.stdout.write(
        `\n${chalk.dim('─── Running pre-commit hooks ───')}\n`
      );

      await execa('git', ['commit', '-m', commitMessage, ...extraArgs], {
        stdio: 'inherit'
      });

      process.stdout.write(`${chalk.dim('─── Hooks complete ───')}\n\n`);

      const { stdout: lastCommit } = await execa('git', [
        'log',
        '-1',
        '--pretty=format:[%h] %s'
      ]);
      commitSummary = lastCommit;
    } else {
      const { stdout } = await execa('git', [
        'commit',
        '-m',
        commitMessage,
        ...extraArgs
      ]);
      commitSummary = stdout.split('\n')[0];
    }

    logSession('COMMITTED', commitSummary);
    outro(`${chalk.green('✔')} ${commitSummary}`);

    // Push flow
    if (config.OCO_GITPUSH === false) return;

    const remotes = await getGitRemotes();
    if (!remotes.length) return;

    if (remotes.length === 1) {
      const shouldPush = await confirm({
        message: `Push to ${remotes[0]}?`
      });

      if (isCancel(shouldPush) || !shouldPush) return;

      const pushSpinner = spinner();
      pushSpinner.start(`Pushing to ${remotes[0]}`);
      const { stdout: pushOut } = await execa('git', [
        'push',
        '--verbose',
        remotes[0]
      ]);
      logSession('PUSHED', remotes[0]);
      pushSpinner.stop(`${chalk.green('✔')} Pushed to ${remotes[0]}`);
      if (pushOut) outro(pushOut);
    } else {
      const selectedRemote = (await select({
        message: 'Push to:',
        options: [
          ...remotes.map((r) => ({ value: r, label: r })),
          { value: '__skip__', label: 'Skip' }
        ]
      })) as string;

      if (isCancel(selectedRemote) || selectedRemote === '__skip__') return;

      const pushSpinner = spinner();
      pushSpinner.start(`Pushing to ${selectedRemote}`);
      const { stdout: pushOut } = await execa('git', [
        'push',
        selectedRemote
      ]);
      logSession('PUSHED', selectedRemote);
      pushSpinner.stop(`${chalk.green('✔')} Pushed to ${selectedRemote}`);
      if (pushOut) outro(pushOut);
    }
  } catch (error) {
    logSession('ERROR', error instanceof Error ? error.message : String(error));
    s.stop(`${chalk.red('✖')} Generation failed`);

    const errorConfig = getConfig();
    const provider = errorConfig.OCO_AI_PROVIDER || 'openai';
    const formatted = formatUserFriendlyError(error, provider);
    outro(printFormattedError(formatted));

    process.exit(1);
  }
};

export async function commit(
  extraArgs: string[] = [],
  context: string = '',
  isStageAllFlag: Boolean = false,
  fullGitMojiSpec: boolean = false,
  skipCommitConfirmation: boolean = false
) {
  if (isStageAllFlag) {
    const changedFiles = await getChangedFiles();

    if (changedFiles) await gitAdd({ files: changedFiles });
    else {
      outro('No changes detected');
      process.exit(1);
    }
  }

  const [stagedFiles, errorStagedFiles] = await trytm(getStagedFiles());
  const [changedFiles, errorChangedFiles] = await trytm(getChangedFiles());

  if (!changedFiles?.length && !stagedFiles?.length) {
    outro(chalk.red('No changes detected'));
    process.exit(1);
  }

  intro(chalk.bold('opencommit'));

  if (errorChangedFiles ?? errorStagedFiles) {
    outro(`${chalk.red('✖')} ${errorChangedFiles ?? errorStagedFiles}`);
    process.exit(1);
  }

  if (stagedFiles.length === 0) {
    const isStageAllAndCommitConfirmedByUser = await confirm({
      message: 'No staged files. Stage all and commit?'
    });

    if (isCancel(isStageAllAndCommitConfirmedByUser)) process.exit(1);

    if (isStageAllAndCommitConfirmedByUser) {
      await commit(extraArgs, context, true, fullGitMojiSpec);
      process.exit(0);
    }

    if (changedFiles.length > 0) {
      const files = (await multiselect({
        message: 'Select files to stage:',
        options: changedFiles.map((file) => ({
          value: file,
          label: file
        }))
      })) as string[];

      if (isCancel(files)) process.exit(0);

      await gitAdd({ files });
    }

    await commit(extraArgs, context, false, fullGitMojiSpec);
    process.exit(0);
  }

  logSession('STAGED', `${stagedFiles.length} file(s): ${stagedFiles.slice(0, 5).join(', ')}${stagedFiles.length > 5 ? '...' : ''}`);

  outro(
    chalk.dim(
      `${stagedFiles.length} file${stagedFiles.length === 1 ? '' : 's'} staged`
    )
  );

  const [, generateCommitError] = await trytm(
    generateCommitMessageFromGitDiff({
      diff: await getDiff({ files: stagedFiles }),
      extraArgs,
      context,
      fullGitMojiSpec,
      skipCommitConfirmation
    })
  );

  if (generateCommitError) {
    outro(`${chalk.red('✖')} ${generateCommitError}`);
    process.exit(1);
  }

  process.exit(0);
}
