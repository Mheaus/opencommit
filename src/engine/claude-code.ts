/**
 * Claude Code engine — uses the `claude` CLI to generate commit messages.
 * Uses -p (print mode) for non-interactive operation.
 * No API key needed — uses the user's Claude Pro/Max plan.
 */

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
    // Extract system instructions and the actual diff
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

    try {
      const { stdout } = await execa(
        'claude',
        [
          '-p',
          '--output-format', 'text',
          '--model', 'sonnet',
          '--no-session-persistence'
        ],
        {
          input: prompt,
          timeout: 120_000,
          env: { ...process.env, TERM: 'dumb' }
        }
      );

      const result = stdout.trim();
      if (!result) return null;

      return result;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(
          'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code'
        );
      }

      if (error.timedOut) {
        throw new Error('Claude CLI timed out after 120 seconds');
      }

      throw new Error(
        `Claude CLI error: ${error.stderr || error.message}`
      );
    }
  };
}
