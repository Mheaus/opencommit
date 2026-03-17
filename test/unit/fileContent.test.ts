import { shouldReadFileContent } from '../../src/utils/fileContent';
import { DiffComplexity } from '../../src/utils/complexity';

describe('shouldReadFileContent', () => {
  it('returns false when disabled', () => {
    expect(shouldReadFileContent(DiffComplexity.COMPLEX, false)).toBe(false);
  });

  it('returns false for SIMPLE diffs', () => {
    expect(shouldReadFileContent(DiffComplexity.SIMPLE, true)).toBe(false);
  });

  it('returns false for MODERATE diffs', () => {
    expect(shouldReadFileContent(DiffComplexity.MODERATE, true)).toBe(false);
  });

  it('returns true for COMPLEX diffs when enabled', () => {
    expect(shouldReadFileContent(DiffComplexity.COMPLEX, true)).toBe(true);
  });
});
