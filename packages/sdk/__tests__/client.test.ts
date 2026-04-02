import { VerdictClient } from '../src/client';
import type { RouterRequest, RouterResponse, ModelStats, EvalResult } from '../src/types';

describe('VerdictClient', () => {
  describe('constructor', () => {
    it('uses default API URL when none provided', () => {
      const client = new VerdictClient();
      // @ts-expect-error accessing private field for test
      expect(client.apiBaseUrl).toBe('https://api.verdict.sh');
    });

    it('accepts custom API URL', () => {
      const client = new VerdictClient({ apiUrl: 'http://localhost:3000' });
      // @ts-expect-error accessing private field for test
      expect(client.apiBaseUrl).toBe('http://localhost:3000');
    });

    it('stores API key when provided', () => {
      const client = new VerdictClient({ apiKey: 'test-key-123' });
      // @ts-expect-error accessing private field for test
      expect(client.apiKey).toBe('test-key-123');
    });

    it('has no API key by default', () => {
      const client = new VerdictClient();
      // @ts-expect-error accessing private field for test
      expect(client.apiKey).toBeUndefined();
    });
  });

  describe('run()', () => {
    it('throws not-yet-implemented error', async () => {
      const client = new VerdictClient();
      await expect(client.run({
        models: ['qwen2.5:32b'],
        pack: 'general'
      })).rejects.toThrow('Not yet implemented');
    });
  });

  describe('fetch wrapper', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
      fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({}),
        status: 200,
        statusText: 'OK',
      } as Response);
    });

    afterEach(() => {
      fetchMock.mockRestore();
    });

    it('calls correct URL for getModel', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async (): Promise<ModelStats> => ({
          name: 'qwen2.5:32b',
          avgScore: 8.5,
          winRate: 62,
          totalRuns: 100,
          domains: {}
        }),
      } as Response);

      const client = new VerdictClient({ apiUrl: 'https://api.verdict.sh' });
      await client.getModel('qwen2.5:32b');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.verdict.sh/models/qwen2.5%3A32b',
        expect.objectContaining({})
      );
    });

    it('includes Authorization header when API key set', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async (): Promise<ModelStats[]> => [],
      } as unknown as Response);

      const client = new VerdictClient({ apiKey: 'sk-test' });
      await client.listModels();

      const callArgs = fetchMock.mock.calls[0];
      const headers: Headers = callArgs[1].headers;
      expect(headers.get('Authorization')).toBe('Bearer sk-test');
    });

    it('does not include Authorization header without API key', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async (): Promise<ModelStats[]> => [],
      } as unknown as Response);

      const client = new VerdictClient();
      await client.listModels();

      const callArgs = fetchMock.mock.calls[0];
      const headers: Headers = callArgs[1].headers;
      expect(headers.get('Authorization')).toBeNull();
    });

    it('throws on non-OK response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const client = new VerdictClient();
      await expect(client.getModel('nonexistent')).rejects.toThrow(
        'Verdict API error: 404 Not Found'
      );
    });

    it('calls correct URL for getLeaderboard with domain filter', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async (): Promise<ModelStats[]> => [],
      } as unknown as Response);

      const client = new VerdictClient({ apiUrl: 'https://api.verdict.sh' });
      await client.getLeaderboard({ domain: 'coding', limit: 10 });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('domain=coding');
      expect(calledUrl).toContain('limit=10');
    });

    it('calls correct URL for route with POST method', async () => {
      const mockRoute: RouterResponse = {
        recommendedModel: 'qwen2.5-coder:32b',
        confidence: 0.92,
        reasoning: 'Best coding model by benchmark',
        alternatives: []
      };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoute,
      } as Response);

      const client = new VerdictClient({ apiUrl: 'https://api.verdict.sh' });
      const request: RouterRequest = {
        prompt: 'Write a Python function to sort a list',
        domain: 'coding'
      };
      const result = await client.route(request);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.verdict.sh/route',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.recommendedModel).toBe('qwen2.5-coder:32b');
    });
  });
});
