/**
 * File content reader for enhanced commit message accuracy.
 * Reads actual file content when diffs are large enough to benefit
 * from understanding the surrounding code context.
 */

import { execa } from 'execa';
import { DiffComplexity } from './complexity';

export interface FileContext {
  path: string;
  /** Excerpt of the file around changed regions */
  content: string;
}

/**
 * Determines whether we should read file content for additional context.
 * Only worth the cost for moderate+ complexity where understanding
 * surrounding code improves commit message accuracy.
 */
export function shouldReadFileContent(
  complexity: DiffComplexity,
  enabled: boolean
): boolean {
  if (!enabled) return false;
  return complexity === DiffComplexity.COMPLEX;
}

/**
 * Extract changed file paths and their hunk line ranges from a diff.
 */
function extractChangedRegions(
  diff: string
): Map<string, Array<{ start: number; count: number }>> {
  const regions = new Map<string, Array<{ start: number; count: number }>>();
  const fileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;

  let currentFile: string | null = null;
  for (const line of diff.split('\n')) {
    const fileMatch = /^diff --git a\/(.+?) b\/(.+?)$/.exec(line);
    if (fileMatch) {
      currentFile = fileMatch[2];
      if (!regions.has(currentFile)) {
        regions.set(currentFile, []);
      }
      continue;
    }

    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunkMatch && currentFile) {
      const start = parseInt(hunkMatch[1], 10);
      const count = parseInt(hunkMatch[2] || '1', 10);
      regions.get(currentFile)!.push({ start, count });
    }
  }

  return regions;
}

/**
 * Read relevant excerpts from changed files.
 * Uses git show to read from the working tree, with context lines
 * around the changed hunks.
 */
export async function readFileContexts(
  diff: string,
  maxTotalTokens: number = 2000
): Promise<FileContext[]> {
  const regions = extractChangedRegions(diff);
  const contexts: FileContext[] = [];
  const CONTEXT_LINES = 10;
  let estimatedTokens = 0;

  for (const [filePath, hunks] of regions) {
    if (estimatedTokens >= maxTotalTokens) break;

    // Skip binary / non-text files
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff|ttf|eot|mp[34]|zip|tar|gz)$/i.test(filePath)) {
      continue;
    }

    try {
      const { stdout: fileContent } = await execa('git', [
        'show',
        `HEAD:${filePath}`
      ]);

      if (!fileContent) continue;

      const lines = fileContent.split('\n');
      const excerpts: string[] = [];

      for (const hunk of hunks) {
        const start = Math.max(0, hunk.start - CONTEXT_LINES - 1);
        const end = Math.min(
          lines.length,
          hunk.start + hunk.count + CONTEXT_LINES
        );
        const excerpt = lines.slice(start, end).join('\n');
        excerpts.push(excerpt);
      }

      const content = excerpts.join('\n...\n');
      // Rough token estimate: ~4 chars per token
      const tokenEstimate = Math.ceil(content.length / 4);

      if (estimatedTokens + tokenEstimate > maxTotalTokens) {
        // Truncate to fit budget
        const remaining = maxTotalTokens - estimatedTokens;
        const truncated = content.slice(0, remaining * 4);
        contexts.push({ path: filePath, content: truncated });
        break;
      }

      contexts.push({ path: filePath, content });
      estimatedTokens += tokenEstimate;
    } catch {
      // File might be new (not in HEAD), skip
      continue;
    }
  }

  return contexts;
}

/**
 * Format file contexts into a prompt-friendly string.
 */
export function formatFileContexts(contexts: FileContext[]): string {
  if (contexts.length === 0) return '';

  const formatted = contexts
    .map((ctx) => `--- ${ctx.path} ---\n${ctx.content}`)
    .join('\n\n');

  return `\nRelevant file context (surrounding code for the changed regions):\n${formatted}`;
}
