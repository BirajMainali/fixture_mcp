import { vi, beforeEach } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => '00000000-0000-0000-0000-000000000001'),
});
