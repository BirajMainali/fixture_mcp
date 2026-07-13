import { describe, it, expect, vi, beforeEach } from 'vitest';

const emitEventMock = vi.hoisted(() => vi.fn());

vi.mock('../db/event-helper.js', () => ({ emitEvent: emitEventMock }));

import { curl } from '../tools/curl.js';

describe('curl tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('makes a GET request and returns response', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: vi.fn().mockResolvedValue('{"ok":true}'),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await curl({
      method: 'GET',
      url: 'https://example.com/api',
      session: 'test-session',
      reason: 'testing curl',
    });

    expect(fetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: undefined,
      body: null,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"ok":true}');
    expect(emitEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionSlug: 'test-session', tool: 'curl' }),
    );
  });

  it('makes a POST request with body', async () => {
    const mockResponse = {
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'x-id': '123' }),
      text: vi.fn().mockResolvedValue('{"id":"123"}'),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await curl({
      method: 'POST',
      url: 'https://example.com/api',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"test"}',
      session: 'test-session',
    });

    expect(fetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"test"}',
    });
    expect(result.status).toBe(201);
    expect(result.headers).toHaveProperty('x-id', '123');
  });

  it('handles network errors gracefully (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    await expect(curl({
      method: 'GET',
      url: 'https://example.com',
      session: 'test-session',
    })).rejects.toThrow('Network failure');
  });

  it('emits event with reason', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('ok'),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await curl({
      method: 'GET',
      url: 'https://example.com',
      session: 'sess-1',
      reason: 'health check',
    });

    expect(emitEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'health check' }),
    );
  });
});
