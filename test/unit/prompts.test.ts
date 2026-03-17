/**
 * Tests for prompt generation.
 * Since the prompts module reads config at import time and has deep
 * dependency chains, we test the prompt output properties rather than
 * mocking internals.
 */

describe('prompts - output validation', () => {
  // We dynamically import to avoid config-at-import-time issues
  let getMainCommitPrompt: typeof import('../../src/prompts').getMainCommitPrompt;
  let EXAMPLE_DIFF: typeof import('../../src/prompts').EXAMPLE_DIFF;

  beforeAll(async () => {
    // Set env vars before import to control config
    process.env.OCO_LANGUAGE = 'en';
    process.env.OCO_EMOJI = 'false';
    process.env.OCO_DESCRIPTION = 'false';
    process.env.OCO_ONE_LINE_COMMIT = 'false';
    process.env.OCO_OMIT_SCOPE = 'false';
    process.env.OCO_WHY = 'false';
    process.env.OCO_FORMAT = 'conventional';
    process.env.OCO_PROMPT_MODULE = 'conventional-commit';
    process.env.OCO_AI_PROVIDER = 'test';
    process.env.OCO_TEST_MOCK_TYPE = 'commit-message';

    const mod = await import('../../src/prompts');
    getMainCommitPrompt = mod.getMainCommitPrompt;
    EXAMPLE_DIFF = mod.EXAMPLE_DIFF;
  });

  afterAll(() => {
    delete process.env.OCO_LANGUAGE;
    delete process.env.OCO_EMOJI;
    delete process.env.OCO_DESCRIPTION;
    delete process.env.OCO_ONE_LINE_COMMIT;
    delete process.env.OCO_OMIT_SCOPE;
    delete process.env.OCO_WHY;
    delete process.env.OCO_FORMAT;
    delete process.env.OCO_PROMPT_MODULE;
    delete process.env.OCO_AI_PROVIDER;
    delete process.env.OCO_TEST_MOCK_TYPE;
  });

  it('returns 3 messages: system, example diff, example response', async () => {
    const messages = await getMainCommitPrompt(false, '');
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[2].role).toBe('assistant');
  });

  it('system prompt enforces conventional commits format', async () => {
    const messages = await getMainCommitPrompt(false, '');
    const systemContent = messages[0].content as string;
    expect(systemContent).toContain('Conventional Commits');
    expect(systemContent).toContain('feat');
    expect(systemContent).toContain('fix');
  });

  it('system prompt enforces English', async () => {
    const messages = await getMainCommitPrompt(false, '');
    const systemContent = messages[0].content as string;
    expect(systemContent).toContain('English');
  });

  it('system prompt enforces imperative present tense', async () => {
    const messages = await getMainCommitPrompt(false, '');
    const systemContent = messages[0].content as string;
    expect(systemContent).toContain('imperative present tense');
  });

  it('includes user context in system prompt when provided', async () => {
    const messages = await getMainCommitPrompt(false, 'fixing auth bug in login flow');
    const systemContent = messages[0].content as string;
    expect(systemContent).toContain('fixing auth bug in login flow');
  });

  it('includes file contexts in system prompt when provided', async () => {
    const fileContexts = [
      { path: 'src/app.ts', content: 'const app = express();' }
    ];
    const messages = await getMainCommitPrompt(false, '', fileContexts);
    const systemContent = messages[0].content as string;
    expect(systemContent).toContain('src/app.ts');
    expect(systemContent).toContain('const app = express()');
  });

  it('example diff contains valid git diff content', () => {
    const content = EXAMPLE_DIFF.content as string;
    expect(content).toContain('diff --git');
    expect(content).toContain('@@');
    expect(content).toContain('+');
    expect(content).toContain('-');
  });

  it('example response follows conventional commit format', async () => {
    const messages = await getMainCommitPrompt(false, '');
    const exampleResponse = messages[2].content as string;
    // Should contain a conventional commit type
    expect(exampleResponse).toMatch(/^(feat|fix|refactor|docs|style|test|build|ci|chore|perf|revert)/);
  });
});
