/**
 * Diff complexity analyzer for smart model routing.
 * Classifies diffs as simple, moderate, or complex based on
 * structural signals — not just size.
 */

export enum DiffComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex'
}

export interface ComplexityAnalysis {
  level: DiffComplexity;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  totalChanges: number;
  fileTypes: Set<string>;
  signals: string[];
}

const SIMPLE_FILE_PATTERNS = [
  /\.md$/i,
  /\.txt$/i,
  /\.json$/i,
  /\.ya?ml$/i,
  /\.toml$/i,
  /\.ini$/i,
  /\.env/i,
  /\.gitignore$/i,
  /\.editorconfig$/i,
  /\.prettierrc/i,
  /\.eslintrc/i,
  /LICENSE/i,
  /CHANGELOG/i
];

const COMPLEX_FILE_PATTERNS = [
  /migrations?\//i,
  /schema\./i,
  /\.proto$/i,
  /\.graphql$/i,
  /api\//i,
  /routes?\//i,
  /middleware/i,
  /auth/i,
  /security/i
];

function getExtension(filePath: string): string {
  const match = filePath.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function isRename(diffBlock: string): boolean {
  return (
    diffBlock.includes('rename from') && diffBlock.includes('rename to')
  );
}

function countChangedLines(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) added++;
    else if (line.startsWith('-') && !line.startsWith('---')) removed++;
  }

  return { added, removed };
}

function extractFilePaths(diff: string): string[] {
  const paths: string[] = [];
  const regex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(diff)) !== null) {
    paths.push(match[2]);
  }

  return paths;
}

export function analyzeDiffComplexity(diff: string): ComplexityAnalysis {
  const filePaths = extractFilePaths(diff);
  const { added, removed } = countChangedLines(diff);
  const totalChanges = added + removed;
  const fileTypes = new Set(filePaths.map(getExtension).filter(Boolean));
  const signals: string[] = [];

  const filesChanged = filePaths.length;

  // Check for rename-only changes
  const diffBlocks = diff.split(/^diff --git /m).filter(Boolean);
  const renameCount = diffBlocks.filter(isRename).length;
  if (renameCount === diffBlocks.length && diffBlocks.length > 0) {
    signals.push('rename-only');
  }

  // Check if all files are simple config/docs
  const allSimple = filePaths.every((fp) =>
    SIMPLE_FILE_PATTERNS.some((p) => p.test(fp))
  );
  if (allSimple && filePaths.length > 0) {
    signals.push('config-or-docs-only');
  }

  // Check for complex file patterns
  const hasComplexFiles = filePaths.some((fp) =>
    COMPLEX_FILE_PATTERNS.some((p) => p.test(fp))
  );
  if (hasComplexFiles) {
    signals.push('touches-critical-paths');
  }

  // Check for multiple language types (cross-cutting change)
  const codeExtensions = new Set(
    [...fileTypes].filter((ext) =>
      ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'rb', 'cs', 'cpp', 'c', 'swift', 'kt'].includes(ext)
    )
  );
  if (codeExtensions.size > 2) {
    signals.push('multi-language');
  }

  // Determine complexity level
  let level: DiffComplexity;

  if (
    signals.includes('rename-only') ||
    (signals.includes('config-or-docs-only') && totalChanges < 100)
  ) {
    level = DiffComplexity.SIMPLE;
  } else if (filesChanged <= 2 && totalChanges <= 50) {
    level = DiffComplexity.SIMPLE;
  } else if (
    filesChanged <= 5 &&
    totalChanges <= 200 &&
    !signals.includes('touches-critical-paths') &&
    !signals.includes('multi-language')
  ) {
    level = DiffComplexity.MODERATE;
  } else {
    level = DiffComplexity.COMPLEX;
  }

  return {
    level,
    filesChanged,
    linesAdded: added,
    linesRemoved: removed,
    totalChanges,
    fileTypes,
    signals
  };
}
