import { analyzeDiffComplexity, DiffComplexity } from '../../src/utils/complexity';

describe('analyzeDiffComplexity', () => {
  it('classifies a single-file small change as SIMPLE', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-const port = 3000;
+const PORT = 3000;
`;
    const result = analyzeDiffComplexity(diff);
    expect(result.level).toBe(DiffComplexity.SIMPLE);
    expect(result.filesChanged).toBe(1);
    expect(result.linesAdded).toBe(1);
    expect(result.linesRemoved).toBe(1);
    expect(result.totalChanges).toBe(2);
  });

  it('classifies rename-only changes as SIMPLE', () => {
    const diff = `diff --git a/old.ts b/new.ts
rename from old.ts
rename to new.ts
diff --git a/old2.ts b/new2.ts
rename from old2.ts
rename to new2.ts
`;
    const result = analyzeDiffComplexity(diff);
    expect(result.level).toBe(DiffComplexity.SIMPLE);
    expect(result.signals).toContain('rename-only');
  });

  it('classifies config/docs-only changes as SIMPLE', () => {
    const diff = `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,5 @@
 # Project
-Old description
+New description
+
+More info
diff --git a/package.json b/package.json
index 1234567..abcdefg 100644
--- a/package.json
+++ b/package.json
@@ -1,3 +1,3 @@
-  "version": "1.0.0"
+  "version": "1.0.1"
`;
    const result = analyzeDiffComplexity(diff);
    expect(result.level).toBe(DiffComplexity.SIMPLE);
    expect(result.signals).toContain('config-or-docs-only');
  });

  it('classifies moderate multi-file changes as MODERATE', () => {
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
      lines.push(`diff --git a/src/file${i}.ts b/src/file${i}.ts`);
      lines.push('index 1234567..abcdefg 100644');
      lines.push(`--- a/src/file${i}.ts`);
      lines.push(`+++ b/src/file${i}.ts`);
      lines.push('@@ -1,10 +1,15 @@');
      for (let j = 0; j < 20; j++) {
        lines.push(`+added line ${j}`);
      }
      for (let j = 0; j < 10; j++) {
        lines.push(`-removed line ${j}`);
      }
    }
    const diff = lines.join('\n');
    const result = analyzeDiffComplexity(diff);
    expect(result.level).toBe(DiffComplexity.MODERATE);
    expect(result.filesChanged).toBe(3);
  });

  it('classifies large cross-cutting changes as COMPLEX', () => {
    const lines: string[] = [];
    const files = [
      'src/api/routes.ts',
      'src/middleware/auth.ts',
      'src/models/user.ts',
      'src/services/email.ts',
      'src/utils/crypto.ts',
      'src/db/migrations/001.ts'
    ];
    for (const file of files) {
      lines.push(`diff --git a/${file} b/${file}`);
      lines.push('index 1234567..abcdefg 100644');
      lines.push(`--- a/${file}`);
      lines.push(`+++ b/${file}`);
      lines.push('@@ -1,50 +1,80 @@');
      for (let j = 0; j < 40; j++) {
        lines.push(`+added line ${j}`);
        lines.push(`-removed line ${j}`);
      }
    }
    const diff = lines.join('\n');
    const result = analyzeDiffComplexity(diff);
    expect(result.level).toBe(DiffComplexity.COMPLEX);
    expect(result.filesChanged).toBe(6);
    expect(result.signals).toContain('touches-critical-paths');
  });

  it('detects multi-language changes', () => {
    const diff = `diff --git a/src/app.ts b/src/app.ts
index 1234567..abcdefg 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@
-old ts
+new ts
diff --git a/src/worker.py b/src/worker.py
index 1234567..abcdefg 100644
--- a/src/worker.py
+++ b/src/worker.py
@@ -1,3 +1,3 @@
-old py
+new py
diff --git a/src/handler.go b/src/handler.go
index 1234567..abcdefg 100644
--- a/src/handler.go
+++ b/src/handler.go
@@ -1,3 +1,3 @@
-old go
+new go
`;
    const result = analyzeDiffComplexity(diff);
    expect(result.signals).toContain('multi-language');
  });

  it('handles empty diff', () => {
    const result = analyzeDiffComplexity('');
    expect(result.level).toBe(DiffComplexity.SIMPLE);
    expect(result.filesChanged).toBe(0);
    expect(result.totalChanges).toBe(0);
  });

  it('counts added and removed lines correctly', () => {
    const diff = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,7 @@
 context line
-removed 1
-removed 2
+added 1
+added 2
+added 3
+added 4
 context line
`;
    const result = analyzeDiffComplexity(diff);
    expect(result.linesAdded).toBe(4);
    expect(result.linesRemoved).toBe(2);
    expect(result.totalChanges).toBe(6);
  });
});
