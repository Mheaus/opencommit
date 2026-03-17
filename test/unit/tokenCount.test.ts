import { tokenCount } from '../../src/utils/tokenCount';

describe('tokenCount', () => {
  it('counts tokens for a simple string', () => {
    const count = tokenCount('hello world');
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  it('counts tokens for an empty string', () => {
    expect(tokenCount('')).toBe(0);
  });

  it('counts tokens for code content', () => {
    const code = 'function add(a: number, b: number): number { return a + b; }';
    const count = tokenCount(code);
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(50);
  });

  it('reuses encoding instance (performance)', () => {
    // Run multiple times — should not create new Tiktoken instances each time
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      tokenCount('test string for performance check ' + i);
    }
    const elapsed = Date.now() - start;
    // Should complete 100 calls in well under 1 second with caching
    expect(elapsed).toBeLessThan(2000);
  });

  it('handles long strings', () => {
    const longString = 'a'.repeat(10000);
    const count = tokenCount(longString);
    expect(count).toBeGreaterThan(100);
  });
});
