import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join as pathJoin } from 'path';

const LOG_DIR = pathJoin(homedir(), '.opencommit', 'logs');

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getSessionLogPath(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return pathJoin(LOG_DIR, `${date}.log`);
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export function logSession(step: string, detail?: string) {
  try {
    ensureLogDir();
    const line = detail
      ? `[${timestamp()}] ${step}: ${detail}`
      : `[${timestamp()}] ${step}`;
    appendFileSync(getSessionLogPath(), line + '\n', 'utf8');
  } catch {
    // Non-critical — never break the main flow
  }
}

export function logSessionSeparator() {
  try {
    ensureLogDir();
    appendFileSync(
      getSessionLogPath(),
      `\n${'─'.repeat(40)} session ${new Date().toISOString().slice(11, 19)} ${'─'.repeat(5)}\n`,
      'utf8'
    );
  } catch {
    // Non-critical
  }
}
