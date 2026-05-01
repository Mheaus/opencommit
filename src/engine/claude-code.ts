/**
 * Claude Code engine — uses the `claude` CLI to generate commit messages.
 * Uses -p (print mode) for non-interactive operation.
 * No API key needed — uses the user's Claude Pro/Max plan.
 *
 * Streams output so the user can see thinking blocks and text as they arrive.
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import { execa } from 'execa';
import { OpenAI } from 'openai';
import { AiEngine, AiEngineConfig } from './Engine';

export class ClaudeCodeEngine implements AiEngine {
  config: AiEngineConfig;
  client: any;

  constructor(config: AiEngineConfig) {
    this.config = config;
    this.client = null;
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMsgs = messages.filter((m) => m.role === 'user');
    const diffMsg = userMsgs[userMsgs.length - 1];

    const system = systemMsg
      ? (typeof systemMsg.content === 'string' ? systemMsg.content : '')
      : '';
    const diff = diffMsg
      ? (typeof diffMsg.content === 'string' ? diffMsg.content : '')
      : '';

    const prompt = [
      system,
      '',
      'Here is the git diff:',
      '',
      diff,
      '',
      'Respond with ONLY the commit message. No explanation, no markdown, no quotes.'
    ].join('\n');

    const model = this.config.model || 'sonnet';

    try {
      return await this._streamGenerate(prompt, model);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(
          'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code'
        );
      }
      if (error.timedOut) {
        throw new Error('Claude CLI timed out after 120 seconds');
      }
      throw new Error(`Claude CLI error: ${error.stderr || error.message}`);
    }
  };

  private async _streamGenerate(prompt: string, model: string): Promise<string | null> {
    const proc = execa(
      'claude',
      [
        '-p',
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--model', model,
        '--no-session-persistence',
        '--tools', '',
        '--no-chrome',
        '--disable-slash-commands'
      ],
      {
        input: prompt,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120_000,
        env: { ...process.env, TERM: 'dumb' }
      }
    );

    let finalResult: string | null = null;
    let lastThinkingLen = 0;
    let lastTextLen = 0;
    let printedThinking = false;
    let printedText = false;

    const rl = createInterface({ input: proc.stdout! });

    for await (const line of rl) {
      if (!line.trim()) continue;

      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      // Stream assistant content as it arrives (partial or complete)
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {

          if (block.type === 'thinking' && typeof block.thinking === 'string') {
            const newChunk = block.thinking.slice(lastThinkingLen);
            if (newChunk) {
              if (!printedThinking) {
                process.stderr.write('\n' + chalk.dim('  💭 '));
                printedThinking = true;
              }
              process.stderr.write(chalk.dim(newChunk));
              lastThinkingLen = block.thinking.length;
            }
          }

          if (block.type === 'text' && typeof block.text === 'string') {
            const newChunk = block.text.slice(lastTextLen);
            if (newChunk) {
              if (!printedText) {
                if (printedThinking) process.stderr.write('\n');
                process.stderr.write('\n' + chalk.dim('  → '));
                printedText = true;
              }
              process.stderr.write(chalk.dim(newChunk));
              lastTextLen = block.text.length;
            }
          }
        }
      }

      // Final result
      if (event.type === 'result' && event.subtype === 'success') {
        finalResult = event.result?.trim() || null;
      }
    }

    if (printedThinking || printedText) {
      process.stderr.write('\n');
    }

    await proc;

    return finalResult;
  }
}
